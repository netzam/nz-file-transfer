import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/appStore';

type TransferRole = 'idle' | 'sender' | 'recipient';

interface PeerPayload {
  deviceId: string;
  deviceName: string;
  userAgent: string;
}

interface IncomingFileMeta {
  name: string;
  size: number;
}

// 16KB chunks are more reliable on iOS Safari/WebKit data channels.
const CHUNK_SIZE = 16 * 1024;

export function useSignal() {
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const [connected, setConnected] = useState(false);
  const [transferRole, setTransferRole] = useState<TransferRole>('idle');
  const [counterpartyName, setCounterpartyName] = useState('');
  const selfDeviceIdRef = useRef('');
  const incomingFileRef = useRef<IncomingFileMeta | null>(null);
  const incomingChunksRef = useRef<ArrayBuffer[]>([]);
  const { setState, roomCode, deviceName } = useAppStore();

  useEffect(() => {
    let retries = 0;
    const connect = () => {
      const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${protocol}://${location.host}/signal`);
      wsRef.current = ws;

      ws.onopen = () => {
        retries = 0;
        ws.send(JSON.stringify({ type: 'hello', payload: { deviceName, userAgent: navigator.userAgent } }));
      };

      ws.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'welcome') {
          selfDeviceIdRef.current = message.payload.deviceId;
          setState({ deviceId: message.payload.deviceId });
        }
        if (message.type === 'room-created') {
          const createdRoom = message.payload.roomCode;
          setState({ roomCode: createdRoom });
          ws.send(JSON.stringify({ type: 'join-room', payload: { roomCode: createdRoom } }));
        }
        if (message.type === 'room-state') {
          const peers = (message.payload.peers as PeerPayload[])
            .filter((p) => p.deviceId !== selfDeviceIdRef.current)
            .map((p) => ({ ...p, status: 'online' as const }));
          setState({ peers });
        }
        if (message.type === 'signal') await onSignal(message.payload.from, message.payload.data);
      };

      ws.onclose = () => {
        const backoff = Math.min(1000 * 2 ** retries, 10_000);
        retries += 1;
        setTimeout(connect, backoff);
      };
    };
    connect();
  }, [deviceName, setState]);

  const saveIncomingFile = (name: string, chunks: ArrayBuffer[]) => {
    const blob = new Blob(chunks);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    const latestHistory = useAppStore.getState().transferHistory;
    setState({
      transferHistory: [`${new Date().toLocaleString()} Received ${name}`, ...latestHistory],
    });
  };

  const handleIncomingData = (payload: string | ArrayBuffer | Blob) => {
    if (typeof payload === 'string') {
      try {
        const message = JSON.parse(payload) as { type?: string; name?: string; size?: number };
        if (message.type === 'file-meta' && message.name && typeof message.size === 'number') {
          incomingFileRef.current = { name: message.name, size: message.size };
          incomingChunksRef.current = [];
        }

        if (message.type === 'file-complete') {
          const currentIncoming = incomingFileRef.current;
          if (currentIncoming && currentIncoming.name === message.name) {
            saveIncomingFile(currentIncoming.name, incomingChunksRef.current);
            incomingFileRef.current = null;
            incomingChunksRef.current = [];
          }
        }
      } catch {
        // Ignore non-control string payloads
      }
      return;
    }

    if (!incomingFileRef.current) return;

    if (payload instanceof Blob) {
      payload.arrayBuffer().then((buffer) => {
        incomingChunksRef.current.push(buffer);
      });
      return;
    }

    incomingChunksRef.current.push(payload);
  };

  const attachDataChannelHandlers = (channel: RTCDataChannel) => {
    channel.binaryType = 'arraybuffer';
    channel.onopen = () => setConnected(true);
    channel.onmessage = (event) => handleIncomingData(event.data);
    channel.onclose = () => {
      setConnected(false);
      setTransferRole('idle');
      setCounterpartyName('');
      incomingFileRef.current = null;
      incomingChunksRef.current = [];
    };
  };

  const createPeerConnection = (remoteDeviceId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
    });

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      wsRef.current?.send(JSON.stringify({ type: 'signal', payload: { to: remoteDeviceId, data: { ice: event.candidate } } }));
    };

    pc.ondatachannel = (event) => {
      dcRef.current = event.channel;
      attachDataChannelHandlers(event.channel);
    };

    pcRef.current = pc;
    return pc;
  };

  const connectToPeer = async (remoteDeviceId: string) => {
    const latestPeers = useAppStore.getState().peers;
    const targetPeer = latestPeers.find((peer) => peer.deviceId === remoteDeviceId);
    setTransferRole('sender');
    setCounterpartyName(targetPeer?.deviceName ?? remoteDeviceId);

    const pc = createPeerConnection(remoteDeviceId);
    const dc = pc.createDataChannel('file-transfer', { ordered: true });
    dcRef.current = dc;
    attachDataChannelHandlers(dc);

    setState({
      peers: latestPeers.map((peer) => (
        peer.deviceId === remoteDeviceId ? { ...peer, status: 'connecting' } : peer
      )),
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    wsRef.current?.send(JSON.stringify({ type: 'signal', payload: { to: remoteDeviceId, data: { sdp: offer } } }));
  };

  const onSignal = async (from: string, data: any) => {
    if (data.sdp?.type === 'offer') {
      const latestPeers = useAppStore.getState().peers;
      const sourcePeer = latestPeers.find((peer) => peer.deviceId === from);
      setTransferRole('recipient');
      setCounterpartyName(sourcePeer?.deviceName ?? from);

      const pc = createPeerConnection(from);
      await pc.setRemoteDescription(data.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      wsRef.current?.send(JSON.stringify({ type: 'signal', payload: { to: from, data: { sdp: answer } } }));
    } else if (data.sdp?.type === 'answer') {
      await pcRef.current?.setRemoteDescription(data.sdp);
      const latestPeers = useAppStore.getState().peers;
      setState({
        peers: latestPeers.map((peer) => (
          peer.deviceId === from ? { ...peer, status: 'connected' } : peer
        )),
      });
    } else if (data.ice) {
      await pcRef.current?.addIceCandidate(data.ice);
    }
  };

  const sendFiles = async (files: FileList, onProgress: (p: number, speed: string, eta: string) => void) => {
    if (!dcRef.current || dcRef.current.readyState !== 'open') {
      throw new Error('Data channel is not open yet. Please wait for Connected status.');
    }

    const all = Array.from(files);
    for (const file of all) {
      if (!dcRef.current || dcRef.current.readyState !== 'open') {
        throw new Error('Connection dropped during transfer.');
      }

      dcRef.current.send(JSON.stringify({ type: 'file-meta', name: file.name, size: file.size }));
      const buffer = await file.arrayBuffer();
      let offset = 0;
      const start = performance.now();

      while (offset < buffer.byteLength) {
        while (dcRef.current.bufferedAmount > 8 * CHUNK_SIZE) {
          await new Promise((r) => setTimeout(r, 25));
        }

        const chunk = buffer.slice(offset, offset + CHUNK_SIZE);
        try {
          dcRef.current.send(chunk);
        } catch (error) {
          throw new Error(`Failed to send chunk for ${file.name}: ${(error as Error).message}`);
        }

        offset += CHUNK_SIZE;
        const elapsed = (performance.now() - start) / 1000;
        const speed = elapsed > 0 ? offset / elapsed : 0;
        const remaining = Math.max(buffer.byteLength - offset, 0);
        const etaSec = speed > 0 ? remaining / speed : 0;
        onProgress(
          Math.min(100, (offset / buffer.byteLength) * 100),
          `${(speed / 1024 / 1024).toFixed(2)} MB/s`,
          `${etaSec.toFixed(1)}s`,
        );
      }

      dcRef.current.send(JSON.stringify({ type: 'file-complete', name: file.name }));
    }

    return all.length;
  };

  const createRoom = () => wsRef.current?.send(JSON.stringify({ type: 'create-room' }));
  const joinRoom = (code: string) => {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) return;
    wsRef.current?.send(JSON.stringify({ type: 'join-room', payload: { roomCode: normalizedCode } }));
  };

  return { roomCode, connected, transferRole, counterpartyName, createRoom, joinRoom, connectToPeer, sendFiles };
}

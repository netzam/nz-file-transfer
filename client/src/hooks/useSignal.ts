import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/appStore';

const CHUNK_SIZE = 128 * 1024;

export function useSignal() {
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const [connected, setConnected] = useState(false);
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
        if (message.type === 'welcome') setState({ deviceId: message.payload.deviceId });
        if (message.type === 'room-created') setState({ roomCode: message.payload.roomCode });
        if (message.type === 'room-state') {
          setState({ peers: message.payload.peers.map((p: any) => ({ ...p, status: 'online' })) });
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
      dcRef.current.binaryType = 'arraybuffer';
      dcRef.current.onopen = () => setConnected(true);
    };

    pcRef.current = pc;
    return pc;
  };

  const connectToPeer = async (remoteDeviceId: string) => {
    const pc = createPeerConnection(remoteDeviceId);
    const dc = pc.createDataChannel('file-transfer', { ordered: true });
    dc.binaryType = 'arraybuffer';
    dc.onopen = () => setConnected(true);
    dcRef.current = dc;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    wsRef.current?.send(JSON.stringify({ type: 'signal', payload: { to: remoteDeviceId, data: { sdp: offer } } }));
  };

  const onSignal = async (from: string, data: any) => {
    if (data.sdp?.type === 'offer') {
      const pc = createPeerConnection(from);
      await pc.setRemoteDescription(data.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      wsRef.current?.send(JSON.stringify({ type: 'signal', payload: { to: from, data: { sdp: answer } } }));
    } else if (data.sdp?.type === 'answer') {
      await pcRef.current?.setRemoteDescription(data.sdp);
    } else if (data.ice) {
      await pcRef.current?.addIceCandidate(data.ice);
    }
  };

  const sendFiles = async (files: FileList, onProgress: (p: number, speed: string, eta: string) => void) => {
    if (!dcRef.current || dcRef.current.readyState !== 'open') return;
    const all = Array.from(files);
    for (const file of all) {
      dcRef.current.send(JSON.stringify({ type: 'file-meta', name: file.name, size: file.size }));
      const buffer = await file.arrayBuffer();
      let offset = 0;
      const start = performance.now();
      while (offset < buffer.byteLength) {
        while (dcRef.current.bufferedAmount > 8 * CHUNK_SIZE) await new Promise((r) => setTimeout(r, 25));
        const chunk = buffer.slice(offset, offset + CHUNK_SIZE);
        dcRef.current.send(chunk);
        offset += CHUNK_SIZE;
        const elapsed = (performance.now() - start) / 1000;
        const speed = elapsed > 0 ? offset / elapsed : 0;
        const remaining = Math.max(buffer.byteLength - offset, 0);
        const etaSec = speed > 0 ? remaining / speed : 0;
        onProgress(Math.min(100, (offset / buffer.byteLength) * 100), `${(speed / 1024 / 1024).toFixed(2)} MB/s`, `${etaSec.toFixed(1)}s`);
      }
      dcRef.current.send(JSON.stringify({ type: 'file-complete', name: file.name }));
    }
  };

  const createRoom = () => wsRef.current?.send(JSON.stringify({ type: 'create-room' }));
  const joinRoom = (code: string) => wsRef.current?.send(JSON.stringify({ type: 'join-room', payload: { roomCode: code.toUpperCase() } }));

  return { roomCode, connected, createRoom, joinRoom, connectToPeer, sendFiles };
}

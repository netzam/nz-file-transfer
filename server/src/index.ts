import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { RoomManager } from './services/roomManager.js';
import type { ServerMessage, SignalMessage, PeerInfo } from './types/messages.js';

const app = express();
app.use(helmet());
app.use(cors());

app.get('/', (_req, res) => {
  res.json({ service: 'nz-file-transfer-signal', status: 'ok' });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

const publicDir = path.resolve(process.cwd(), 'public');
if (existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });
const rooms = new RoomManager();
const sockets = new Map<string, import('ws').WebSocket>();
const peers = new Map<string, PeerInfo & { wsId: string }>();

function send(wsId: string, message: ServerMessage) {
  const ws = sockets.get(wsId);
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

setInterval(() => rooms.cleanupExpiredRooms(), 60_000);

server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/signal') return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
});

wss.on('connection', (ws) => {
  const wsId = randomUUID();
  sockets.set(wsId, ws);

  ws.on('message', (buffer) => {
    try {
      const message = JSON.parse(buffer.toString()) as SignalMessage;

      if (message.type === 'hello') {
        const deviceId = randomUUID();
        const peer = {
          deviceId,
          deviceName: message.payload.deviceName,
          userAgent: message.payload.userAgent,
          lastSeen: Date.now(),
          wsId,
        };
        peers.set(deviceId, peer);
        send(wsId, { type: 'welcome', payload: { deviceId } });
      }

      if (message.type === 'create-room') {
        const roomCode = rooms.createRoom();
        send(wsId, { type: 'room-created', payload: { roomCode } });
      }

      if (message.type === 'join-room') {
        const owner = [...peers.values()].find((p) => p.wsId === wsId);
        if (!owner) return;
        const room = rooms.joinRoom(message.payload.roomCode.toUpperCase(), owner);
        if (!room) return send(wsId, { type: 'error', payload: { message: 'Room not found/expired' } });
        const roomPeers = [...room.peers.values()].map(({ wsId: _wsId, ...p }) => p);
        for (const p of room.peers.values()) {
          send(p.wsId, { type: 'room-state', payload: { roomCode: room.code, peers: roomPeers } });
          if (p.wsId !== wsId) send(p.wsId, { type: 'peer-joined', payload: owner });
        }
      }

      if (message.type === 'signal') {
        const sender = [...peers.values()].find((p) => p.wsId === wsId);
        if (!sender) return;
        const target = peers.get(message.payload.to);
        if (!target) return;
        send(target.wsId, { type: 'signal', payload: { from: sender.deviceId, data: message.payload.data } });
      }

      if (message.type === 'ping') send(wsId, { type: 'pong' });
    } catch {
      send(wsId, { type: 'error', payload: { message: 'Invalid message' } });
    }
  });

  ws.on('close', () => {
    const left = rooms.leaveByWsId(wsId);
    if (left?.removed && left.roomCode) {
      for (const p of peers.values()) {
        if (p.wsId !== wsId) send(p.wsId, { type: 'peer-left', payload: { deviceId: left.removed.deviceId } });
      }
      peers.delete(left.removed.deviceId);
    }
    sockets.delete(wsId);
  });
});

const port = Number(process.env.PORT ?? 8080);
server.listen(port, () => {
  console.log(`Signal server listening on ${port}`);
});

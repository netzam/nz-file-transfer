import { customAlphabet } from 'nanoid';
import type { PeerInfo } from '../types/messages.js';

const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);
const ROOM_TTL_MS = Number(process.env.ROOM_TTL_MS ?? 1000 * 60 * 60);

type Peer = PeerInfo & { wsId: string };

type Room = {
  code: string;
  createdAt: number;
  peers: Map<string, Peer>;
};

export class RoomManager {
  private rooms = new Map<string, Room>();
  private wsToRoom = new Map<string, string>();

  createRoom() {
    const code = nanoid();
    this.rooms.set(code, { code, createdAt: Date.now(), peers: new Map() });
    return code;
  }

  joinRoom(code: string, peer: Peer) {
    const room = this.rooms.get(code);
    if (!room) return null;
    room.peers.set(peer.deviceId, peer);
    this.wsToRoom.set(peer.wsId, code);
    return room;
  }

  leaveByWsId(wsId: string) {
    const roomCode = this.wsToRoom.get(wsId);
    if (!roomCode) return null;
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    let removed: Peer | null = null;
    for (const [id, p] of room.peers) {
      if (p.wsId === wsId) {
        removed = p;
        room.peers.delete(id);
        break;
      }
    }
    this.wsToRoom.delete(wsId);
    if (room.peers.size === 0) this.rooms.delete(roomCode);
    return { roomCode, removed };
  }

  getRoomByWsId(wsId: string) {
    const roomCode = this.wsToRoom.get(wsId);
    return roomCode ? this.rooms.get(roomCode) : undefined;
  }

  cleanupExpiredRooms() {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (now - room.createdAt > ROOM_TTL_MS) {
        for (const peer of room.peers.values()) this.wsToRoom.delete(peer.wsId);
        this.rooms.delete(code);
      }
    }
  }
}

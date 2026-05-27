export type SignalMessage =
  | { type: 'hello'; payload: { deviceName: string; userAgent: string } }
  | { type: 'join-room'; payload: { roomCode: string } }
  | { type: 'create-room' }
  | { type: 'signal'; payload: { to: string; data: unknown } }
  | { type: 'presence' }
  | { type: 'leave-room' }
  | { type: 'ping' };

export type ServerMessage =
  | { type: 'welcome'; payload: { deviceId: string; roomCode?: string } }
  | { type: 'room-created'; payload: { roomCode: string } }
  | { type: 'room-state'; payload: { peers: PeerInfo[]; roomCode: string } }
  | { type: 'peer-joined'; payload: PeerInfo }
  | { type: 'peer-left'; payload: { deviceId: string } }
  | { type: 'signal'; payload: { from: string; data: unknown } }
  | { type: 'error'; payload: { message: string } }
  | { type: 'pong' };

export interface PeerInfo {
  deviceId: string;
  deviceName: string;
  userAgent: string;
  lastSeen: number;
}

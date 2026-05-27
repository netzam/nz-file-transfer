import { create } from 'zustand';

export interface PeerCard {
  deviceId: string;
  deviceName: string;
  userAgent: string;
  status: 'online' | 'connecting' | 'connected';
}

interface AppState {
  deviceId: string;
  deviceName: string;
  roomCode: string;
  peers: PeerCard[];
  transferHistory: string[];
  autoAccept: boolean;
  setState: (patch: Partial<AppState>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  deviceId: '',
  deviceName: '',
  roomCode: '',
  peers: [],
  transferHistory: [],
  autoAccept: false,
  setState: (patch) => set(patch),
}));

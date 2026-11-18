import { create } from 'zustand';
import type { LobbyState } from '@crew-tanks/shared/types';

export interface HudState {
  hp: number;
  maxHp: number;
}

interface Store {
  lobby: LobbyState | null;
  hud: HudState;
  setLobby: (lobby: LobbyState | null) => void;
  /** Writes only when a value actually changed, so React never re-renders per frame. */
  setHp: (hp: number, maxHp: number) => void;
}

export const useStore = create<Store>((set, get) => ({
  lobby: null,
  hud: { hp: 0, maxHp: 0 },
  setLobby: (lobby) => set({ lobby }),
  setHp: (hp, maxHp) => {
    const { hud } = get();
    if (hud.hp !== hp || hud.maxHp !== maxHp) set({ hud: { hp, maxHp } });
  },
}));

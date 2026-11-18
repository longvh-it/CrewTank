import { create } from 'zustand';
import { KILL_FEED_MAX } from '@crew-tanks/shared/constants';
import type { AmmoKind, LobbyState, MatchResult, TeamId } from '@crew-tanks/shared/types';

export interface HudState {
  hp: number;
  maxHp: number;
  specialKind: AmmoKind | null;
  specialAmmo: number;
}

export interface KillFeedEntry {
  id: number;
  killer: string;
  victim: string;
  killerTeam: TeamId;
}

const MUTE_KEY = 'crew-tanks-muted';

interface Store {
  muted: boolean;
  setMuted: (muted: boolean) => void;
  lobby: LobbyState | null;
  hud: HudState;
  score: Record<TeamId, number>;
  remainingSec: number;
  killFeed: KillFeedEntry[];
  results: MatchResult | null;
  setLobby: (lobby: LobbyState | null) => void;
  setResults: (results: MatchResult) => void;
  /** The setters below write only when a value actually changed, so React never re-renders per frame. */
  setOwn: (hp: number, maxHp: number, specialKind: AmmoKind | null, specialAmmo: number) => void;
  setScore: (red: number, blue: number) => void;
  setRemaining: (sec: number) => void;
  pushKill: (entry: Omit<KillFeedEntry, 'id'>) => void;
}

const FRESH_MATCH = {
  hud: { hp: 0, maxHp: 0, specialKind: null, specialAmmo: 0 } as HudState,
  score: { red: 0, blue: 0 },
  remainingSec: 0,
  killFeed: [] as KillFeedEntry[],
  results: null,
};

let killId = 0;

export const useStore = create<Store>((set, get) => ({
  muted: localStorage.getItem(MUTE_KEY) === '1',
  setMuted: (muted) => {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    set({ muted });
  },
  lobby: null,
  ...FRESH_MATCH,
  setLobby: (lobby) => {
    const entering = lobby?.phase === 'playing' && get().lobby?.phase !== 'playing';
    set(entering ? { lobby, ...FRESH_MATCH } : { lobby });
  },
  setResults: (results) => set({ results }),
  setOwn: (hp, maxHp, specialKind, specialAmmo) => {
    const { hud } = get();
    // hp changes in whole points only (repair heals fractions); the HUD shows rounded HP
    const shown = Math.ceil(hp);
    if (hud.hp !== shown || hud.maxHp !== maxHp || hud.specialKind !== specialKind || hud.specialAmmo !== specialAmmo) {
      set({ hud: { hp: shown, maxHp, specialKind, specialAmmo } });
    }
  },
  setScore: (red, blue) => {
    const { score } = get();
    if (score.red !== red || score.blue !== blue) set({ score: { red, blue } });
  },
  setRemaining: (sec) => {
    if (get().remainingSec !== sec) set({ remainingSec: sec });
  },
  pushKill: (entry) => set((s) => ({ killFeed: [...s.killFeed, { ...entry, id: ++killId }].slice(-KILL_FEED_MAX) })),
}));

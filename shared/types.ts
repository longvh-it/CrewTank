// Socket protocol + domain types. Source: docs/ARCHITECTURE.md.

export type TeamId = 'red' | 'blue';
export type Seat = 'driver' | 'gunner';
export type Phase = 'lobby' | 'playing' | 'ended';
export type AmmoKind = 'normal' | 'explosive' | 'piercing' | 'smoke';

export interface PlayerInfo {
  id: string;            // playerId cố định (lưu trong localStorage), không phải socket.id
  name: string;
  team: TeamId | null;
  tankId: string | null;
  seat: Seat | null;
  isHost: boolean;
  connected: boolean;
}

export interface TankSlot {
  id: string;
  team: TeamId;
  driverId: string | null;
  gunnerId: string | null;
}

export interface LobbySettings { killLimit: number; timeLimitSec: number; mapId: string }

export interface LobbyState {
  code: string;
  phase: Phase;
  players: PlayerInfo[];
  tanks: TankSlot[];
  settings: LobbySettings;
}

export interface PlayerInput {
  seq: number;
  move?: { throttle: -1 | 0 | 1; turn: -1 | 0 | 1; boost: boolean; repair: boolean };
  aim?: { angle: number; fire: boolean; special: boolean };
  swap: boolean;
}

export interface TankState {
  id: string; team: TeamId;
  x: number; y: number; bodyAngle: number; turretAngle: number;
  hp: number; maxHp: number; alive: boolean; respawnAt: number | null;
  crew: 1 | 2; specialAmmo: number; specialKind: AmmoKind | null; boostReadyAt: number;
}

export interface BulletState { id: string; x: number; y: number; kind: AmmoKind }

export interface PickupState { id: string; x: number; y: number; kind: AmmoKind | 'repair'; active: boolean }

export interface SmokeZone { id: string; x: number; y: number; r: number; endsAt: number }

export interface GameSnapshot {
  t: number;                         // thời gian server, ms
  tanks: TankState[];
  bullets: BulletState[];
  pickups: PickupState[];
  smokes: SmokeZone[];
  score: Record<TeamId, number>;
  endsAt: number;
}

export interface PlayerStats {
  playerId: string; kills: number; assists: number; deaths: number;
  damage: number; shots: number; hits: number;
}

export type GameEvent =
  | { type: 'hit'; tankId: string; dmg: number }
  | { type: 'kill'; killerTankId: string; victimTankId: string }
  | { type: 'explode'; x: number; y: number; r: number }
  | { type: 'pickup'; tankId: string; kind: AmmoKind | 'repair' };

export interface MatchResult {
  winner: TeamId | null;
  score: Record<TeamId, number>;
  stats: PlayerStats[];
  awards: { mvp?: string; bestDriver?: string; bestDuo?: [string, string] };
}

type Ack<T> = (r: ({ ok: true } & T) | { ok: false; error: string }) => void;

export interface ClientToServer {
  'room:create': (name: string, playerId: string, ack: Ack<{ code: string }>) => void;
  'room:join': (code: string, name: string, playerId: string, ack: Ack<{}>) => void;
  'lobby:pickSeat': (tankId: string, seat: Seat) => void;
  'lobby:leaveSeat': () => void;
  'lobby:movePlayer': (playerId: string, tankId: string, seat: Seat) => void; // chỉ chủ phòng
  'lobby:autoBalance': () => void;                                             // chỉ chủ phòng
  'lobby:settings': (s: Partial<LobbySettings>) => void;                       // chỉ chủ phòng
  'lobby:start': () => void;                                                   // chỉ chủ phòng
  'game:input': (input: PlayerInput) => void;
}

export interface ServerToClient {
  'lobby:state': (s: LobbyState) => void;
  'game:start': (mapId: string) => void;
  'game:state': (s: GameSnapshot) => void;
  'game:event': (e: GameEvent) => void;
  'game:end': (r: MatchResult) => void;
}

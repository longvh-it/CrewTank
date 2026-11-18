import { MAX_TANKS_PER_TEAM, SHORTHANDED_HP_BONUS } from './constants';
import { canPickSeat } from './teams';
import type { PlayerInfo, Seat, TankSlot, TeamId } from './types';

const TEAMS: readonly TeamId[] = ['red', 'blue'];
const SEATS: readonly Seat[] = ['driver', 'gunner'];

export interface LobbySeating {
  players: PlayerInfo[];
  tanks: TankSlot[];
}

const isEmpty = (t: TankSlot): boolean => t.driverId === null && t.gunnerId === null;

/**
 * Keep slots tidy: drop empty ones, then add exactly one empty slot per team (up to
 * MAX_TANKS_PER_TEAM) so there is always a seat to sit in. Existing ids stay stable.
 */
export function normalizeTanks(tanks: readonly TankSlot[]): TankSlot[] {
  const out: TankSlot[] = [];
  for (const team of TEAMS) {
    const mine = tanks.filter((t) => t.team === team && !isEmpty(t));
    out.push(...mine.map((t) => ({ ...t })));
    if (mine.length < MAX_TANKS_PER_TEAM) {
      const used = new Set(mine.map((t) => t.id));
      let n = 1;
      while (used.has(`${team}-${n}`)) n++;
      out.push({ id: `${team}-${n}`, team, driverId: null, gunnerId: null });
    }
  }
  return out;
}

function clearSeat(tanks: TankSlot[], playerId: string): TankSlot[] {
  return tanks.map((t) => ({
    ...t,
    driverId: t.driverId === playerId ? null : t.driverId,
    gunnerId: t.gunnerId === playerId ? null : t.gunnerId,
  }));
}

function withPlayer(players: readonly PlayerInfo[], playerId: string, patch: Partial<PlayerInfo>): PlayerInfo[] {
  return players.map((p) => (p.id === playerId ? { ...p, ...patch } : p));
}

/** Move a player to a vacant seat (leaving their previous one). Returns null when the seat is not allowed. */
export function seatPlayer(
  players: readonly PlayerInfo[],
  tanks: readonly TankSlot[],
  playerId: string,
  tankId: string,
  seat: Seat,
): LobbySeating | null {
  if (!canPickSeat(players, tanks, playerId, tankId, seat)) return null;
  const target = tanks.find((t) => t.id === tankId);
  if (!target) return null;
  const cleared = clearSeat([...tanks], playerId).map((t) =>
    t.id === tankId ? { ...t, [seat === 'driver' ? 'driverId' : 'gunnerId']: playerId } : t,
  );
  return {
    players: withPlayer(players, playerId, { team: target.team, tankId, seat }),
    tanks: normalizeTanks(cleared),
  };
}

/** Stand a player up; they become unseated (team null). */
export function unseatPlayer(players: readonly PlayerInfo[], tanks: readonly TankSlot[], playerId: string): LobbySeating {
  return {
    players: withPlayer(players, playerId, { team: null, tankId: null, seat: null }),
    tanks: normalizeTanks(clearSeat([...tanks], playerId)),
  };
}

function crewCount(t: TankSlot): number {
  return (t.driverId ? 1 : 0) + (t.gunnerId ? 1 : 0);
}

/**
 * Seat everyone who has no seat yet: smaller team first (red on ties), joining a
 * half-filled tank when there is one, otherwise starting a new tank.
 */
export function fillUnseated(players: readonly PlayerInfo[], tanks: readonly TankSlot[]): LobbySeating {
  let state: LobbySeating = { players: [...players], tanks: normalizeTanks(tanks) };
  for (const p of players) {
    if (p.tankId) continue;
    const size = (team: TeamId) => state.players.filter((q) => q.team === team).length;
    const order = size('red') <= size('blue') ? TEAMS : [...TEAMS].reverse();
    let placed: LobbySeating | null = null;
    for (const team of order) {
      const candidates = state.tanks
        .filter((t) => t.team === team)
        .sort((a, b) => crewCount(b) - crewCount(a) || a.id.localeCompare(b.id))
        .filter((t) => crewCount(t) < 2);
      for (const t of candidates) {
        const seat = SEATS.find((s) => (s === 'driver' ? t.driverId : t.gunnerId) === null);
        if (seat) placed = seatPlayer(state.players, state.tanks, p.id, t.id, seat);
        if (placed) break;
      }
      if (placed) break;
    }
    if (placed) state = placed;
  }
  return state;
}

export interface MatchTank {
  id: string;
  team: TeamId;
  crew: 1 | 2;
  hpBonus: number;
}

/** Occupied slots as game tanks. A solo tank on the 3-player team of a 7-player match gets +20% HP. */
export function matchTanks(players: readonly PlayerInfo[], tanks: readonly TankSlot[]): MatchTank[] {
  const out: MatchTank[] = [];
  for (const t of tanks) {
    const crew = crewCount(t);
    if (crew === 0) continue;
    const teamSize = players.filter((p) => p.team === t.team).length;
    const shorthanded = players.length === 7 && teamSize === 3 && crew === 1;
    out.push({ id: t.id, team: t.team, crew: crew === 2 ? 2 : 1, hpBonus: shorthanded ? SHORTHANDED_HP_BONUS : 0 });
  }
  return out;
}

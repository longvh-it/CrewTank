import { describe, expect, it } from 'vitest';
import { fillUnseated, matchTanks, normalizeTanks, seatPlayer, unseatPlayer } from './lobby';
import { autoBalance } from './teams';
import { MAX_TANKS_PER_TEAM } from './constants';
import type { PlayerInfo } from './types';

const player = (id: string): PlayerInfo => ({ id, name: id, team: null, tankId: null, seat: null, isHost: false, connected: true });
const players = (n: number): PlayerInfo[] => Array.from({ length: n }, (_, i) => player(`p${i + 1}`));

describe('normalizeTanks', () => {
  it('starts with one empty slot per team', () => {
    expect(normalizeTanks([])).toEqual([
      { id: 'red-1', team: 'red', driverId: null, gunnerId: null },
      { id: 'blue-1', team: 'blue', driverId: null, gunnerId: null },
    ]);
  });
  it('caps tanks per team', () => {
    const full = Array.from({ length: MAX_TANKS_PER_TEAM }, (_, i) => ({ id: `red-${i + 1}`, team: 'red' as const, driverId: `x${i}`, gunnerId: null }));
    expect(normalizeTanks(full).filter((t) => t.team === 'red')).toHaveLength(MAX_TANKS_PER_TEAM);
  });
});

describe('seatPlayer / unseatPlayer', () => {
  it('seats a player, moves them when they pick another seat, and keeps a spare slot', () => {
    const ps = players(2);
    let s = { players: ps, tanks: normalizeTanks([]) };
    s = seatPlayer(s.players, s.tanks, 'p1', 'red-1', 'driver')!;
    expect(s.players[0]).toMatchObject({ team: 'red', tankId: 'red-1', seat: 'driver' });
    expect(s.tanks.filter((t) => t.team === 'red')).toHaveLength(2);
    s = seatPlayer(s.players, s.tanks, 'p1', 'blue-1', 'gunner')!;
    expect(s.players[0]).toMatchObject({ team: 'blue', tankId: 'blue-1', seat: 'gunner' });
    expect(s.tanks.find((t) => t.id === 'red-1')).toMatchObject({ driverId: null, gunnerId: null });
  });
  it('rejects occupied seats and unknown tanks', () => {
    let s = { players: players(2), tanks: normalizeTanks([]) };
    s = seatPlayer(s.players, s.tanks, 'p1', 'red-1', 'driver')!;
    expect(seatPlayer(s.players, s.tanks, 'p2', 'red-1', 'driver')).toBeNull();
    expect(seatPlayer(s.players, s.tanks, 'p2', 'nope', 'driver')).toBeNull();
    expect(seatPlayer(s.players, s.tanks, 'ghost', 'red-1', 'gunner')).toBeNull();
  });
  it('unseats', () => {
    let s = { players: players(1), tanks: normalizeTanks([]) };
    s = seatPlayer(s.players, s.tanks, 'p1', 'red-1', 'driver')!;
    s = unseatPlayer(s.players, s.tanks, 'p1');
    expect(s.players[0]).toMatchObject({ team: null, tankId: null, seat: null });
    expect(s.tanks.every((t) => t.driverId === null)).toBe(true);
  });
});

describe('fillUnseated', () => {
  it('seats everyone, balancing the teams and pairing crews', () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const s = fillUnseated(players(n), normalizeTanks([]));
      expect(s.players.every((p) => p.tankId && p.seat && p.team)).toBe(true);
      const red = s.players.filter((p) => p.team === 'red').length;
      const blue = s.players.filter((p) => p.team === 'blue').length;
      expect(Math.abs(red - blue)).toBeLessThanOrEqual(1);
      // each player in exactly one seat
      const seats = s.tanks.flatMap((t) => [t.driverId, t.gunnerId]).filter(Boolean);
      expect(new Set(seats).size).toBe(n);
    }
  });
  it('keeps existing seats', () => {
    let s = { players: players(3), tanks: normalizeTanks([]) };
    s = seatPlayer(s.players, s.tanks, 'p3', 'blue-1', 'gunner')!;
    const f = fillUnseated(s.players, s.tanks);
    expect(f.players.find((p) => p.id === 'p3')).toMatchObject({ tankId: 'blue-1', seat: 'gunner' });
  });
});

describe('matchTanks', () => {
  it('7 players: solo tank of the 3-player team gets the HP bonus, others do not', () => {
    const balanced = autoBalance(players(7));
    const tanks = matchTanks(balanced.players, balanced.tanks);
    const solo = tanks.filter((t) => t.crew === 1);
    expect(solo).toHaveLength(1);
    expect(solo[0]?.hpBonus).toBe(0.2);
    expect(tanks.filter((t) => t.crew === 2).every((t) => t.hpBonus === 0)).toBe(true);
  });
  it('skips empty slots; 6 players give 2+2+... tanks with no bonus', () => {
    const s = fillUnseated(players(6), normalizeTanks([]));
    const tanks = matchTanks(s.players, s.tanks);
    expect(tanks.reduce((n, t) => n + t.crew, 0)).toBe(6);
    expect(tanks.every((t) => t.hpBonus === 0)).toBe(true);
  });
});

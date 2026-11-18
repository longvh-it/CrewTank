import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_ROOM_TTL_SEC, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@crew-tanks/shared/constants';
import { generateRoomCode, RoomManager } from './RoomManager';
import type { Game } from './Game';
import { parseRoomCode, parseRoomPlayer } from './validate';

/** Stub games: record start/stop/tanks so tests can check the per-room lifecycle. */
interface GameRecord { started: number; stopped: number; tanks: string[] }
function stubManager() {
  const games = new Map<string, GameRecord>();
  const manager = new RoomManager((code) => {
    const record: GameRecord = { started: 0, stopped: 0, tanks: [] };
    games.set(code, record);
    return {
      start: () => record.started++,
      stop: () => record.stopped++,
      addTank: (t: { id: string }) => record.tanks.push(t.id),
      removeTank: (id: string) => { record.tanks = record.tanks.filter(x => x !== id); },
    } as unknown as Game;
  });
  return { manager, games };
}

afterEach(() => { vi.useRealTimers(); });

describe('rooms', () => {
  it('generates codes from the configured alphabet', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      expect([...code].every(char => ROOM_CODE_ALPHABET.includes(char))).toBe(true);
    }
  });

  it('keeps rooms separate and hands the host to the next player', () => {
    const { manager } = stubManager();
    const one = manager.create('One', '1', 's1');
    const two = manager.create('Two', '2', 's2');
    manager.join(one.code, 'Three', '3', 's3');
    expect(one.players.map(player => player.name)).toEqual(['One', 'Three']);
    expect(two.players.map(player => player.name)).toEqual(['Two']);
    expect(manager.join(one.code, 'Duplicate', '3', 's4')).toBeNull();
    manager.leave(one.code, 's1');
    expect(one.players[0]?.isHost).toBe(true);
    expect(two.players[0]?.isHost).toBe(true);
  });

  it('deletes empty rooms after the TTL and cancels cleanup when rejoined', () => {
    vi.useFakeTimers();
    const { manager } = stubManager();
    const room = manager.create('One', '1', 's1');
    manager.leave(room.code, 's1');
    vi.advanceTimersByTime(EMPTY_ROOM_TTL_SEC * 1000 - 1);
    expect(manager.get(room.code)).toBeDefined();
    manager.join(room.code, 'Two', '2', 's2');
    vi.advanceTimersByTime(1);
    expect(manager.get(room.code)?.players[0]?.isHost).toBe(true);
    manager.leave(room.code, 's2');
    vi.advanceTimersByTime(EMPTY_ROOM_TTL_SEC * 1000);
    expect(manager.get(room.code)).toBeUndefined();
  });

  it('gives every room its own game on start and stops it when the room is deleted', () => {
    vi.useFakeTimers();
    const { manager, games } = stubManager();
    const one = manager.create('One', '1', 's1');
    const two = manager.create('Two', '2', 's2');
    expect(games.size).toBe(0);
    manager.start(one.code, 's1');
    manager.start(two.code, 's2');
    expect(manager.gameOf(one.code)).not.toBe(manager.gameOf(two.code));
    expect(games.get(one.code)).toMatchObject({ started: 1, stopped: 0, tanks: ['red-1'] });
    manager.leave(one.code, 's1');
    vi.advanceTimersByTime(EMPTY_ROOM_TTL_SEC * 1000);
    expect(games.get(one.code)).toMatchObject({ started: 1, stopped: 1 });
    expect(games.get(two.code)).toMatchObject({ started: 1, stopped: 0 });
    expect(manager.gameOf(one.code)).toBeUndefined();
  });

  it('seats players by click, only into vacant seats, and the host can move others', () => {
    const { manager } = stubManager();
    const room = manager.create('Host', 'h', 'sh');
    manager.join(room.code, 'Guest', 'g', 'sg');
    expect(manager.pickSeat(room.code, 'sh', 'red-1', 'driver')).not.toBeNull();
    expect(manager.pickSeat(room.code, 'sg', 'red-1', 'driver')).toBeNull();
    expect(manager.pickSeat(room.code, 'sg', 'red-1', 'gunner')).not.toBeNull();
    expect(manager.movePlayer(room.code, 'sg', 'h', 'blue-1', 'driver')).toBeNull(); // not host
    expect(manager.movePlayer(room.code, 'sh', 'g', 'blue-1', 'driver')).not.toBeNull();
    expect(room.players.find(p => p.id === 'g')).toMatchObject({ team: 'blue', tankId: 'blue-1', seat: 'driver' });
    expect(manager.leaveSeat(room.code, 'sg')?.players.find(p => p.id === 'g')?.tankId).toBeNull();
  });

  it('only the host can auto-balance, change settings and start; start seats everyone and builds tanks from slots', () => {
    const { manager, games } = stubManager();
    const room = manager.create('A', 'a', 'sa');
    for (const [i, id] of ['b', 'c', 'd'].entries()) manager.join(room.code, id.toUpperCase(), id, `s${id}`);
    expect(manager.autoBalance(room.code, 'sb')).toBeNull();
    expect(manager.setSettings(room.code, 'sb', { killLimit: 10 })).toBeNull();
    expect(manager.start(room.code, 'sb')).toBeNull();
    expect(manager.setSettings(room.code, 'sa', { killLimit: 10 })?.settings.killLimit).toBe(10);
    expect(manager.autoBalance(room.code, 'sa')?.players.every(p => p.tankId)).toBe(true);
    const started = manager.start(room.code, 'sa');
    expect(started?.phase).toBe('playing');
    expect(games.get(room.code)?.tanks).toHaveLength(2); // 4 players -> two 2-crew tanks
    expect(manager.seatOf(room.code, 'sa')).toMatchObject({ tankId: expect.any(String) });
    expect(manager.join(room.code, 'Late', 'l', 'sl')).toBeNull(); // no joining mid-match
    expect(manager.pickSeat(room.code, 'sa', 'red-1', 'driver')).toBeNull();
  });

  it('removes a tank from the running game when its whole crew has left', () => {
    const { manager, games } = stubManager();
    const room = manager.create('A', 'a', 'sa');
    manager.join(room.code, 'B', 'b', 'sb');
    manager.start(room.code, 'sa');
    const [t1, t2] = games.get(room.code)!.tanks;
    expect(t1).toBeDefined();
    manager.leave(room.code, 'sb');
    expect(games.get(room.code)?.tanks).toEqual([t1]);
    expect(t2).toBeDefined();
  });

  it('validates room payloads', () => {
    expect(parseRoomPlayer(' A ', '123e4567-e89b-42d3-a456-426614174000')?.name).toBe('A');
    expect(parseRoomPlayer(' ', 'bad')).toBeNull();
    expect(parseRoomCode('ABCD')).toBe('ABCD');
    expect(parseRoomCode('0000')).toBeNull();
  });
});

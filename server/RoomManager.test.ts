import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_ROOM_TTL_SEC, RECONNECT_GRACE_SEC, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@crew-tanks/shared/constants';
import { generateRoomCode, RoomManager } from './RoomManager';
import type { Game } from './Game';
import type { LobbyState, MatchResult } from '@crew-tanks/shared/types';
import { parseRoomCode, parseRoomPlayer } from './validate';

/** Stub games: record start/stop/tanks so tests can check the per-room lifecycle. */
interface GameRecord { started: number; stopped: number; tanks: string[]; inputs: string[] }
function stubManager() {
  const games = new Map<string, GameRecord>();
  const changes: LobbyState[] = [];
  const manager = new RoomManager((code) => {
    const record: GameRecord = { started: 0, stopped: 0, tanks: [], inputs: [] };
    games.set(code, record);
    return {
      start: () => record.started++,
      stop: () => record.stopped++,
      addTank: (t: { id: string }) => record.tanks.push(t.id),
      removeTank: (id: string) => { record.tanks = record.tanks.filter(x => x !== id); },
      setInput: (tankId: string, seat: string) => record.inputs.push(`${tankId}:${seat}`),
    } as unknown as Game;
  }, (state) => changes.push(state));
  return { manager, games, changes };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

const RESULT: MatchResult = { winner: null, score: { red: 0, blue: 0 }, stats: [], awards: {} };
/** The connection dropped and never came back: the grace period runs out. */
function leaveForGood(manager: RoomManager, code: string, socketId: string) {
  manager.disconnect(code, socketId);
  vi.advanceTimersByTime(RECONNECT_GRACE_SEC * 1000);
}

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
    expect(manager.join(one.code, 'Duplicate', '3', 's4')).toBeNull(); // same playerId still connected
    leaveForGood(manager, one.code, 's1');
    expect(one.players[0]?.isHost).toBe(true);
    expect(two.players[0]?.isHost).toBe(true);
  });

  it('deletes empty rooms after the TTL and cancels cleanup when rejoined', () => {
    const { manager } = stubManager();
    const room = manager.create('One', '1', 's1');
    leaveForGood(manager, room.code, 's1');
    vi.advanceTimersByTime(EMPTY_ROOM_TTL_SEC * 1000 - 1);
    expect(manager.get(room.code)).toBeDefined();
    manager.join(room.code, 'Two', '2', 's2');
    vi.advanceTimersByTime(1);
    expect(manager.get(room.code)?.players[0]?.isHost).toBe(true);
    leaveForGood(manager, room.code, 's2');
    vi.advanceTimersByTime(EMPTY_ROOM_TTL_SEC * 1000);
    expect(manager.get(room.code)).toBeUndefined();
  });

  it('gives every room its own game on start and stops it when the room is deleted', () => {
    const { manager, games } = stubManager();
    const one = manager.create('One', '1', 's1');
    const two = manager.create('Two', '2', 's2');
    expect(games.size).toBe(0);
    manager.start(one.code, 's1');
    manager.start(two.code, 's2');
    expect(manager.gameOf(one.code)).not.toBe(manager.gameOf(two.code));
    expect(games.get(one.code)).toMatchObject({ started: 1, stopped: 0, tanks: ['red-1'] });
    leaveForGood(manager, one.code, 's1');
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
    leaveForGood(manager, room.code, 'sb');
    expect(games.get(room.code)?.tanks).toEqual([t1]);
    expect(t2).toBeDefined();
  });

  it('after a match only the host can return to the lobby, keeping teams and seats', () => {
    const { manager, games } = stubManager();
    const room = manager.create('A', 'a', 'sa');
    manager.join(room.code, 'B', 'b', 'sb');
    manager.start(room.code, 'sa');
    const seatsBefore = room.players.map(p => `${p.id}:${p.tankId}:${p.seat}`);
    expect(manager.returnToLobby(room.code, 'sa')).toBeNull(); // match still running
    expect(manager.finish(room.code, RESULT)?.phase).toBe('ended');
    expect(games.get(room.code)?.stopped).toBe(1);
    expect(manager.returnToLobby(room.code, 'sb')).toBeNull(); // not host
    expect(manager.returnToLobby(room.code, 'sa')?.phase).toBe('lobby');
    expect(room.players.map(p => `${p.id}:${p.tankId}:${p.seat}`)).toEqual(seatsBefore);
    expect(manager.gameOf(room.code)).toBeUndefined();
    // a second match can be started with the same seating
    expect(manager.start(room.code, 'sa')?.phase).toBe('playing');
    expect(games.get(room.code)?.started).toBe(1); // record replaced by the new game's record
    expect(manager.finish(room.code, RESULT)).not.toBeNull();
  });

  it('a dropped player keeps their seat for the grace period and can come back mid-match with the same playerId', () => {
    const { manager, games } = stubManager();
    const room = manager.create('A', 'a', 'sa');
    manager.join(room.code, 'B', 'b', 'sb');
    manager.start(room.code, 'sa');
    const seatB = manager.seatOf(room.code, 'sb')!;
    const dropped = manager.disconnect(room.code, 'sb');
    expect(dropped?.players.find(p => p.id === 'b')).toMatchObject({ connected: false, tankId: seatB.tankId, seat: seatB.seat });
    expect(games.get(room.code)?.inputs).toContain(`${seatB.tankId}:${seatB.seat}`); // controls went neutral
    expect(manager.seatOf(room.code, 'sb')).toBeNull(); // old socket no longer maps to a seat
    vi.advanceTimersByTime(RECONNECT_GRACE_SEC * 1000 - 1);
    expect(manager.join(room.code, 'B', 'b', 'sb2')).not.toBeNull(); // F5: new socket, same playerId
    vi.advanceTimersByTime(RECONNECT_GRACE_SEC * 1000 * 2);
    expect(room.players.find(p => p.id === 'b')).toMatchObject({ connected: true, tankId: seatB.tankId, seat: seatB.seat });
    expect(manager.seatOf(room.code, 'sb2')).toEqual(seatB);
    expect(games.get(room.code)?.tanks).toContain(seatB.tankId);
  });

  it('after the grace period the player is removed: tank gone, host handed on', () => {
    const { manager, games, changes } = stubManager();
    const room = manager.create('A', 'a', 'sa');
    manager.join(room.code, 'B', 'b', 'sb');
    manager.start(room.code, 'sa');
    manager.disconnect(room.code, 'sa'); // the host drops
    expect(room.players.find(p => p.id === 'a')?.isHost).toBe(true); // still host during the grace period
    vi.advanceTimersByTime(RECONNECT_GRACE_SEC * 1000);
    expect(room.players.map(p => p.id)).toEqual(['b']);
    expect(room.players[0]?.isHost).toBe(true);
    expect(games.get(room.code)?.tanks).toHaveLength(1);
    expect(changes.at(-1)?.players).toHaveLength(1); // the server is told so it can broadcast
    expect(manager.join(room.code, 'A', 'a', 'sa2')).toBeNull(); // too late mid-match
  });

  it('rejects a second connection for a player who is still connected, and strangers mid-match', () => {
    const { manager } = stubManager();
    const room = manager.create('A', 'a', 'sa');
    expect(manager.join(room.code, 'A', 'a', 'sx')).toBeNull();
    manager.start(room.code, 'sa');
    expect(manager.join(room.code, 'New', 'n', 'sn')).toBeNull();
  });

  it('reconnecting at the scoreboard can still see the result', () => {
    const { manager } = stubManager();
    const room = manager.create('A', 'a', 'sa');
    manager.start(room.code, 'sa');
    manager.finish(room.code, RESULT);
    manager.disconnect(room.code, 'sa');
    expect(manager.join(room.code, 'A', 'a', 'sa2')?.phase).toBe('ended');
    expect(manager.resultOf(room.code)).toBe(RESULT);
  });

  it('leave frees the seat at once, hands the host on and ignores strangers', () => {
    const { manager } = stubManager();
    const room = manager.create('A', 'a', 'sa');
    manager.join(room.code, 'B', 'b', 'sb');
    manager.join(room.code, 'C', 'c', 'sc');
    manager.autoBalance(room.code, 'sa');
    expect(manager.leave(room.code, 'nobody')).toBeNull();
    const state = manager.leave(room.code, 'sa');
    expect(state?.players.map(p => p.id)).toEqual(['b', 'c']);
    expect(state?.players.find(p => p.id === 'b')?.isHost).toBe(true);
    expect(state?.tanks.some(t => t.driverId === 'a' || t.gunnerId === 'a')).toBe(false);
    // no grace timer: nothing left to fire, and the same socket can no longer act
    expect(manager.leave(room.code, 'sa')).toBeNull();
    expect(manager.join(room.code, 'A', 'a', 'sa2')?.players.map(p => p.id)).toContain('a');
  });

  it('leave mid-match sends neutral input and drops an emptied tank', () => {
    const { manager, games } = stubManager();
    const room = manager.create('A', 'a', 'sa');
    manager.start(room.code, 'sa');
    const tank = manager.seatOf(room.code, 'sa')?.tankId;
    manager.leave(room.code, 'sa');
    expect(games.get(room.code)?.inputs).toContain(`${tank}:driver`);
    expect(games.get(room.code)?.tanks).not.toContain(tank);
  });

  it('validates room payloads', () => {
    expect(parseRoomPlayer(' A ', '123e4567-e89b-42d3-a456-426614174000')?.name).toBe('A');
    expect(parseRoomPlayer(' ', 'bad')).toBeNull();
    expect(parseRoomCode('ABCD')).toBe('ABCD');
    expect(parseRoomCode('0000')).toBeNull();
  });
});

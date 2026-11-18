import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_ROOM_TTL_SEC, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@crew-tanks/shared/constants';
import { generateRoomCode, RoomManager } from './RoomManager';
import { parseRoomCode, parseRoomPlayer } from './validate';

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
    const manager = new RoomManager();
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
    const manager = new RoomManager();
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

  it('validates room payloads', () => {
    expect(parseRoomPlayer(' A ', '123e4567-e89b-42d3-a456-426614174000')?.name).toBe('A');
    expect(parseRoomPlayer(' ', 'bad')).toBeNull();
    expect(parseRoomCode('ABCD')).toBe('ABCD');
    expect(parseRoomCode('0000')).toBeNull();
  });
});

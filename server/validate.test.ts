import { describe, expect, it } from 'vitest';
import { parsePlayerInput, parseSeatMove, parseSeatPick, parseSettings, RateLimiter } from './validate';

const ok = {
  seq: 1,
  move: { throttle: 1, turn: 0, boost: false, repair: false },
  aim: { angle: 1.2, fire: false, special: false },
  swap: false,
};

describe('parsePlayerInput', () => {
  it('accepts a valid input', () => {
    expect(parsePlayerInput(ok)).toEqual(ok);
  });
  it('accepts input without move/aim', () => {
    expect(parsePlayerInput({ seq: 0, swap: false })).not.toBeNull();
  });
  it('rejects bad payloads', () => {
    expect(parsePlayerInput(null)).toBeNull();
    expect(parsePlayerInput({ ...ok, move: { ...ok.move, throttle: 2 } })).toBeNull();
    expect(parsePlayerInput({ ...ok, aim: { ...ok.aim, angle: NaN } })).toBeNull();
    expect(parsePlayerInput({ ...ok, x: 100 })).not.toBeNull(); // unknown top-level keys are stripped
    expect(parsePlayerInput({ ...ok, move: { ...ok.move, x: 5 } })).toBeNull();
  });
  it('never exposes client-supplied positions', () => {
    expect(parsePlayerInput({ ...ok, x: 100, y: 5 })).not.toHaveProperty('x');
  });
});

describe('RateLimiter', () => {
  it('allows max per second then blocks, then resets', () => {
    const rl = new RateLimiter(3);
    expect([0, 1, 2, 3].map(() => rl.allow(100))).toEqual([true, true, true, false]);
    expect(rl.allow(1200)).toBe(true);
  });
});

describe('lobby payloads', () => {
  const id = '123e4567-e89b-42d3-a456-426614174000';
  it('parses seat picks and moves', () => {
    expect(parseSeatPick('red-1', 'driver')).toEqual({ tankId: 'red-1', seat: 'driver' });
    expect(parseSeatPick('red-1', 'pilot')).toBeNull();
    expect(parseSeatPick(5, 'driver')).toBeNull();
    expect(parseSeatMove(id, 'blue-2', 'gunner')).toEqual({ playerId: id, tankId: 'blue-2', seat: 'gunner' });
    expect(parseSeatMove('nope', 'blue-2', 'gunner')).toBeNull();
  });
  it('parses settings within limits only', () => {
    expect(parseSettings({ killLimit: 10 })).toEqual({ killLimit: 10 });
    expect(parseSettings({ killLimit: 1 })).toBeNull();
    expect(parseSettings({ timeLimitSec: 10 })).toBeNull();
    expect(parseSettings({ mapId: 'nope' })).toBeNull();
    expect(parseSettings({ mapId: 'arena-01', extra: 1 })).toBeNull();
  });
});

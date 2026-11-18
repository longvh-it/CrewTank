import { describe, expect, it } from 'vitest';
import { parsePlayerInput, RateLimiter } from './validate';

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

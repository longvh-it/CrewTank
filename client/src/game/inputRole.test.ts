import { describe, expect, it } from 'vitest';
import { inputForRole } from './inputRole';
import type { PlayerInput } from '@crew-tanks/shared/types';

const full: PlayerInput = {
  seq: 3,
  move: { throttle: 1, turn: -1, boost: false, repair: false },
  aim: { angle: 1, fire: true, special: false },
  swap: false,
};

describe('inputForRole', () => {
  it('solo sends both move and aim', () => expect(inputForRole(full, 'solo')).toEqual(full));
  it('driver sends only move', () => {
    const r = inputForRole(full, 'driver');
    expect(r.move).toEqual(full.move);
    expect(r).not.toHaveProperty('aim');
    expect(r.seq).toBe(3);
  });
  it('gunner sends only aim', () => {
    const r = inputForRole(full, 'gunner');
    expect(r.aim).toEqual(full.aim);
    expect(r).not.toHaveProperty('move');
  });
});

import { describe, expect, it } from 'vitest';
import { Interpolator, lerp, lerpAngle, lerpSnapshot } from './Interpolator';
import { INTERP_DELAY_MS } from '@crew-tanks/shared/constants';
import type { GameSnapshot, TankState } from '@crew-tanks/shared/types';

const tank = (id: string, x: number, bodyAngle = 0): TankState => ({
  id, team: 'red', x, y: 0, bodyAngle, turretAngle: 0, hp: 100, maxHp: 100, alive: true,
  respawnAt: null, invulnerableUntil: 0, crew: 1, specialAmmo: 0, specialKind: null, boostReadyAt: 0,
});
const snap = (t: number, tanks: TankState[]): GameSnapshot => ({
  t, tanks, bullets: [], pickups: [], smokes: [], score: { red: 0, blue: 0 }, endsAt: 0,
});

describe('lerp / lerpAngle', () => {
  it('lerps linearly', () => expect(lerp(10, 20, 0.25)).toBe(12.5));
  it('takes the shortest arc across the seam', () => {
    const d = Math.PI / 180;
    expect(lerpAngle(170 * d, -170 * d, 0.5)).toBeCloseTo(Math.PI);
    expect(lerpAngle(-170 * d, 170 * d, 0.5)).toBeCloseTo(Math.PI);
    expect(lerpAngle(0, 90 * d, 0.5)).toBeCloseTo(45 * d);
  });
});

describe('lerpSnapshot', () => {
  it('blends shared tanks and keeps new ones as-is', () => {
    const r = lerpSnapshot(snap(0, [tank('a', 0)]), snap(100, [tank('a', 100), tank('b', 7)]), 0.5);
    expect(r.tanks.find((t) => t.id === 'a')?.x).toBe(50);
    expect(r.tanks.find((t) => t.id === 'b')?.x).toBe(7);
  });
});

describe('lerpSnapshot bullets', () => {
  it('interpolates bullets by id', () => {
    const a = { ...snap(0, []), bullets: [{ id: 'b1', x: 0, y: 0, kind: 'normal' as const }] };
    const b = { ...snap(100, []), bullets: [{ id: 'b1', x: 40, y: 20, kind: 'normal' as const }, { id: 'b2', x: 5, y: 5, kind: 'normal' as const }] };
    const r = lerpSnapshot(a, b, 0.5);
    expect(r.bullets[0]).toMatchObject({ x: 20, y: 10 });
    expect(r.bullets[1]).toMatchObject({ x: 5, y: 5 });
  });
});

describe('Interpolator', () => {
  it('renders INTERP_DELAY_MS in the past', () => {
    const ip = new Interpolator();
    // server clock == client clock + 1000
    ip.push(snap(1000, [tank('a', 0)]), 0);
    ip.push(snap(1050, [tank('a', 50)]), 50);
    ip.push(snap(1100, [tank('a', 100)]), 100);
    // client now=INTERP_DELAY_MS+75 → render server time 1075
    const s = ip.sample(INTERP_DELAY_MS + 75);
    expect(s?.tanks[0]?.x).toBeCloseTo(75);
  });
  it('holds the last snapshot instead of extrapolating', () => {
    const ip = new Interpolator();
    ip.push(snap(1000, [tank('a', 0)]), 0);
    ip.push(snap(1050, [tank('a', 50)]), 50);
    expect(ip.sample(10_000)?.tanks[0]?.x).toBe(50);
  });
  it('returns null with no data', () => expect(new Interpolator().sample(0)).toBeNull());
});

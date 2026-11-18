import { describe, expect, it } from 'vitest';
import { moveTank, rotateToward, wrapAngle, type TankPose } from './physics';
import { TANK_STATS, WORLD_WIDTH } from './constants';
import type { PlayerInput } from './types';

const S = TANK_STATS[1];
const DEG = Math.PI / 180;
const pose: TankPose = { x: 500, y: 400, bodyAngle: 0, turretAngle: 0 };
const move = (throttle: -1 | 0 | 1, turn: -1 | 0 | 1): PlayerInput => ({
  seq: 1,
  move: { throttle, turn, boost: false, repair: false },
  swap: false,
});

describe('wrapAngle', () => {
  it('wraps into (-PI, PI]', () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(-Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(1.5 * Math.PI)).toBeCloseTo(-0.5 * Math.PI);
  });
});

describe('rotateToward', () => {
  it('takes the shortest arc across the +-PI seam', () => {
    const r = rotateToward(170 * DEG, -170 * DEG, 5 * DEG);
    expect(r).toBeCloseTo(175 * DEG);
  });
  it('snaps when within step', () => {
    expect(rotateToward(0, 0.01, 0.1)).toBeCloseTo(0.01);
  });
});

describe('moveTank', () => {
  it('drives forward along the body angle at stats.speed', () => {
    const r = moveTank(pose, move(1, 0), S, 0.5);
    expect(r.x).toBeCloseTo(500 + S.speed * 0.5);
    expect(r.y).toBeCloseTo(400);
  });
  it('reverses', () => {
    expect(moveTank(pose, move(-1, 0), S, 0.5).x).toBeCloseTo(500 - S.speed * 0.5);
  });
  it('turns the body without moving when throttle is 0', () => {
    const r = moveTank(pose, move(0, 1), S, 0.2);
    expect(r.bodyAngle).toBeCloseTo(S.bodyTurnSpeed * DEG * 0.2);
    expect(r.x).toBe(500);
  });
  it('clamps to the world', () => {
    const r = moveTank({ ...pose, x: WORLD_WIDTH - 1 }, move(1, 0), S, 1);
    expect(r.x).toBe(WORLD_WIDTH);
  });
  it('rotates turret toward aim, independent of body, limited by turn speed', () => {
    const input: PlayerInput = { seq: 1, aim: { angle: Math.PI / 2, fire: false, special: false }, swap: false };
    const r = moveTank(pose, input, S, 0.1);
    expect(r.turretAngle).toBeCloseTo(S.turretTurnSpeed * DEG * 0.1);
    expect(r.bodyAngle).toBe(0);
  });
  it('does not mutate the input pose', () => {
    const before = { ...pose };
    moveTank(pose, move(1, 1), S, 0.1);
    expect(pose).toEqual(before);
  });
});

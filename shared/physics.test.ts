import { describe, expect, it } from 'vitest';
import { collideTanks, collideWalls, moveTank, rotateToward, wrapAngle, type TankPose } from './physics';
import type { CollisionGrid } from './map';
import { TANK_RADIUS, TANK_STATS, WORLD_WIDTH } from './constants';
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

describe('wall collision', () => {
  // 5x5 grid, border walls, tile 32
  const solid = new Uint8Array(25);
  for (let i = 0; i < 5; i++) solid[i] = solid[20 + i] = solid[i * 5] = solid[i * 5 + 4] = 1;
  const grid: CollisionGrid = { cols: 5, rows: 5, tileSize: 32, solid };
  const R = TANK_RADIUS;
  const at = (x: number, y: number, bodyAngle: number): TankPose => ({ x, y, bodyAngle, turretAngle: 0 });

  it('charging straight into a wall stops at the wall face', () => {
    let p = at(80, 80, 0); // facing +x, east wall face at x=128
    for (let i = 0; i < 90; i++) p = moveTank(p, move(1, 0), S, 1 / 30, grid);
    expect(p.x).toBeCloseTo(128 - R, 5);
    expect(p.y).toBeCloseTo(80, 5);
  });

  it('driving diagonally into a corner never enters either wall and does not stick', () => {
    let p = at(80, 80, Math.PI / 4); // toward the SE corner (128,128)
    for (let i = 0; i < 120; i++) {
      p = moveTank(p, move(1, 0), S, 1 / 30, grid);
      expect(p.x).toBeLessThanOrEqual(128 - R + 1e-6);
      expect(p.y).toBeLessThanOrEqual(128 - R + 1e-6);
    }
    expect(p.x).toBeCloseTo(128 - R, 3);
    expect(p.y).toBeCloseTo(128 - R, 3);
    // can still back out
    const back = moveTank(p, move(-1, 0), S, 0.5, grid);
    expect(Math.hypot(back.x - p.x, back.y - p.y)).toBeGreaterThan(10);
  });

  it('slides along a wall when hitting it at an angle', () => {
    let p = at(80, 80, Math.PI / 4);
    for (let i = 0; i < 12; i++) p = moveTank(p, move(1, 0), S, 1 / 30, grid);
    const yBefore = p.y;
    // now aim mostly into the east wall but slightly down: x pinned, y keeps advancing
    p = at(128 - R, 60, 0.3);
    const r = moveTank(p, move(1, 0), S, 0.1, grid);
    expect(r.x).toBeCloseTo(128 - R, 5);
    expect(r.y).toBeGreaterThan(60 + 1);
    expect(yBefore).toBeGreaterThan(0);
  });

  it('pushes a tank whose centre is inside a wall tile back out', () => {
    const r = collideWalls({ x: 130, y: 80 }, grid);
    expect(r.x).toBeCloseTo(128 - R, 5);
  });

  it('leaves free-space positions untouched', () => {
    expect(collideWalls({ x: 80, y: 80 }, grid)).toEqual({ x: 80, y: 80 });
  });
});

describe('collideTanks', () => {
  it('pushes two overlapping tanks apart symmetrically to exactly 2R', () => {
    const [a, b] = collideTanks([{ x: 100, y: 100 }, { x: 110, y: 100 }]);
    expect(b!.x - a!.x).toBeCloseTo(TANK_RADIUS * 2);
    expect((a!.x + b!.x) / 2).toBeCloseTo(105);
    expect(a!.y).toBe(100);
  });
  it('leaves separated tanks alone', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    expect(collideTanks(pts)).toEqual(pts);
  });
  it('handles perfectly stacked tanks', () => {
    const [a, b] = collideTanks([{ x: 50, y: 50 }, { x: 50, y: 50 }]);
    expect(Math.hypot(b!.x - a!.x, b!.y - a!.y)).toBeCloseTo(TANK_RADIUS * 2);
  });
});

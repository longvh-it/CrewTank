import { describe, expect, it } from 'vitest';
import { bulletHitsTank, bulletSubsteps, stepBullet, stepBulletOnce, type BulletBody } from './physics';
import type { CollisionGrid } from './map';
import { BULLET_MAX_SUBSTEP, BULLET_SPEED, TICK_HZ } from './constants';

// 7x7 grid, tile 32, open interior, 1-tile border walls
const N = 7;
const solid = new Uint8Array(N * N);
for (let i = 0; i < N; i++) solid[i] = solid[(N - 1) * N + i] = solid[i * N] = solid[i * N + N - 1] = 1;
const grid: CollisionGrid = { cols: N, rows: N, tileSize: 32, solid };
const DT = 1 / TICK_HZ;
const bullet = (x: number, y: number, vx: number, vy: number, bounces = 0): BulletBody => ({ x, y, vx, vy, bounces });

describe('bullet sub-steps', () => {
  it('never moves more than BULLET_MAX_SUBSTEP per sub-step', () => {
    const n = bulletSubsteps(BULLET_SPEED, DT);
    expect((BULLET_SPEED * DT) / n).toBeLessThanOrEqual(BULLET_MAX_SUBSTEP);
  });
});

describe('wall bounce', () => {
  it('flips vx on a vertical wall and keeps vy', () => {
    // east wall face at x = 6*32 = 192; start close to it
    const r = stepBullet(bullet(188, 100, 300, 200), DT, grid);
    expect(r.alive).toBe(true);
    expect(r.bullet.vx).toBe(-300);
    expect(r.bullet.vy).toBe(200);
    expect(r.bullet.bounces).toBe(1);
    expect(r.bullet.x).toBeLessThan(192);
  });
  it('flips vy on a horizontal wall and keeps vx', () => {
    // south wall face at y = 192
    const r = stepBullet(bullet(100, 188, 200, 300), DT, grid);
    expect(r.bullet.vy).toBe(-300);
    expect(r.bullet.vx).toBe(200);
    expect(r.bullet.y).toBeLessThan(192);
  });
  it('reflects both components in a corner', () => {
    const r = stepBulletOnce(bullet(191, 191, 400, 400), 0.01, grid);
    expect(r.bullet.vx).toBe(-400);
    expect(r.bullet.vy).toBe(-400);
  });
  it('dies on the third wall hit (max 2 bounces)', () => {
    const b1 = stepBulletOnce(bullet(191, 100, 400, 0), 0.01, grid);
    expect(b1.alive).toBe(true);
    const b2 = stepBulletOnce(bullet(191, 100, 400, 0, 1), 0.01, grid);
    expect(b2.alive).toBe(true);
    const b3 = stepBulletOnce(bullet(191, 100, 400, 0, 2), 0.01, grid);
    expect(b3.alive).toBe(false);
  });
});

describe('no tunnelling through a 1-tile wall', () => {
  // inner 1-tile-thick wall at column 3 (x 96..128) with openings none, rows 1..5
  const s2 = new Uint8Array(solid);
  for (let r = 1; r < N - 1; r++) s2[r * N + 3] = 1;
  const g2: CollisionGrid = { ...grid, solid: s2 };

  it('max-speed bullets from many sub-tick offsets and angles never end up past the wall', () => {
    for (let off = 0; off < 16; off += 0.5) {
      for (const ang of [0, 0.3, -0.3, 0.7, -0.7]) {
        let b = bullet(97 - 40 + off, 100, Math.cos(ang) * BULLET_SPEED, Math.sin(ang) * BULLET_SPEED);
        for (let i = 0; i < 6; i++) {
          const r = stepBullet(b, DT, g2);
          if (!r.alive) break;
          b = r.bullet;
          const col = Math.floor(b.x / 32);
          const row = Math.floor(b.y / 32);
          expect(g2.solid[row * N + col]).toBe(0); // never inside a wall tile
          if (b.vx > 0) expect(b.x).toBeLessThan(96);
        }
      }
    }
  });
});

describe('bulletHitsTank', () => {
  it('hits inside tank radius + bullet radius, misses outside', () => {
    expect(bulletHitsTank({ x: 20, y: 0 }, { x: 0, y: 0 })).toBe(true);
    expect(bulletHitsTank({ x: 30, y: 0 }, { x: 0, y: 0 })).toBe(false);
  });
});

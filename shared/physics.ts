import type { PlayerInput } from './types';
import type { TankStats } from './constants';
import { BULLET_MAX_BOUNCES, BULLET_MAX_SUBSTEP, BULLET_RADIUS, TANK_RADIUS, WORLD_HEIGHT, WORLD_WIDTH } from './constants';
import { isSolid, type CollisionGrid, type Point } from './map';

const DEG = Math.PI / 180;

export interface TankPose {
  x: number;
  y: number;
  bodyAngle: number;
  turretAngle: number;
}

/** Wrap an angle into (-PI, PI]. */
export function wrapAngle(a: number): number {
  const twoPi = Math.PI * 2;
  let r = (((a + Math.PI) % twoPi) + twoPi) % twoPi - Math.PI;
  if (r === -Math.PI) r = Math.PI;
  return r;
}

/** Rotate `from` toward `to` by at most `maxStep` radians along the shortest arc. */
export function rotateToward(from: number, to: number, maxStep: number): number {
  const diff = wrapAngle(to - from);
  if (Math.abs(diff) <= maxStep) return wrapAngle(to);
  return wrapAngle(from + Math.sign(diff) * maxStep);
}

const COLLISION_PASSES = 4;

/**
 * Push a circle out of every solid tile it overlaps. Pure. Moving first and resolving after
 * keeps the tangential motion, so a tank slides along walls instead of sticking.
 */
export function collideWalls(p: Point, grid: CollisionGrid, radius: number = TANK_RADIUS): Point {
  let { x, y } = p;
  const ts = grid.tileSize;
  for (let pass = 0; pass < COLLISION_PASSES; pass++) {
    let moved = false;
    const c0 = Math.floor((x - radius) / ts);
    const c1 = Math.floor((x + radius) / ts);
    const r0 = Math.floor((y - radius) / ts);
    const r1 = Math.floor((y + radius) / ts);
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        if (!isSolid(grid, col, row)) continue;
        const left = col * ts;
        const top = row * ts;
        const nx = Math.min(Math.max(x, left), left + ts);
        const ny = Math.min(Math.max(y, top), top + ts);
        const dx = x - nx;
        const dy = y - ny;
        const d2 = dx * dx + dy * dy;
        if (d2 >= radius * radius) continue;
        if (d2 > 0) {
          const d = Math.sqrt(d2);
          x += (dx / d) * (radius - d);
          y += (dy / d) * (radius - d);
        } else {
          // centre inside the tile: leave through the nearest face
          const toLeft = x - left;
          const toRight = left + ts - x;
          const toTop = y - top;
          const toBottom = top + ts - y;
          const m = Math.min(toLeft, toRight, toTop, toBottom);
          if (m === toLeft) x = left - radius;
          else if (m === toRight) x = left + ts + radius;
          else if (m === toTop) y = top - radius;
          else y = top + ts + radius;
        }
        moved = true;
      }
    }
    if (!moved) break;
  }
  return { x, y };
}

/** Separate overlapping tanks by pushing each pair apart half-and-half. Pure; same order in, same order out. */
export function collideTanks(points: readonly Point[], radius: number = TANK_RADIUS): Point[] {
  const out = points.map((p) => ({ x: p.x, y: p.y }));
  const minDist = radius * 2;
  for (let pass = 0; pass < COLLISION_PASSES; pass++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i];
        const b = out[j];
        if (!a || !b) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= minDist) continue;
        if (d === 0) {
          dx = 1;
          dy = 0;
          d = 1;
        }
        const push = (minDist - d) / 2;
        a.x -= (dx / d) * push;
        a.y -= (dy / d) * push;
        b.x += (dx / d) * push;
        b.y += (dy / d) * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return out;
}

/**
 * Advance one tank by `dt` seconds. Pure: returns a new pose.
 * `move` steers the body (driver), `aim` turns the turret (gunner). Missing parts keep their value.
 * Clamped to the world rectangle; when `grid` is given, also resolved against wall tiles.
 */
export function moveTank(pose: TankPose, input: PlayerInput, stats: TankStats, dt: number, grid?: CollisionGrid): TankPose {
  let { x, y, bodyAngle, turretAngle } = pose;
  if (input.move) {
    bodyAngle = wrapAngle(bodyAngle + input.move.turn * stats.bodyTurnSpeed * DEG * dt);
    const dist = input.move.throttle * stats.speed * dt;
    x = Math.min(Math.max(x + Math.cos(bodyAngle) * dist, 0), WORLD_WIDTH);
    y = Math.min(Math.max(y + Math.sin(bodyAngle) * dist, 0), WORLD_HEIGHT);
  }
  if (grid) ({ x, y } = collideWalls({ x, y }, grid));
  if (input.aim) {
    turretAngle = rotateToward(turretAngle, input.aim.angle, stats.turretTurnSpeed * DEG * dt);
  }
  return { x, y, bodyAngle, turretAngle };
}

export interface BulletBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  bounces: number;
}

/** Number of sub-steps so each moves at most `maxSubstep` px. */
export function bulletSubsteps(speed: number, dt: number, maxSubstep: number = BULLET_MAX_SUBSTEP): number {
  return Math.max(1, Math.ceil((speed * dt) / maxSubstep));
}

function solidAt(grid: CollisionGrid, x: number, y: number): boolean {
  return isSolid(grid, Math.floor(x / grid.tileSize), Math.floor(y / grid.tileSize));
}

/**
 * Advance a bullet by one sub-step of `fraction` of a tick (`dt` seconds). Reflects the velocity
 * component that hit a wall (both at a corner). Returns alive=false once it would exceed `maxBounces`.
 */
export function stepBulletOnce(
  b: BulletBody,
  dt: number,
  grid: CollisionGrid,
  maxBounces: number = BULLET_MAX_BOUNCES,
): { bullet: BulletBody; alive: boolean } {
  const nx = b.x + b.vx * dt;
  const ny = b.y + b.vy * dt;
  if (!solidAt(grid, nx, ny)) return { bullet: { ...b, x: nx, y: ny }, alive: true };

  const hitX = solidAt(grid, nx, b.y);
  const hitY = solidAt(grid, b.x, ny);
  const flipX = hitX || !hitY; // corner (neither axis alone) flips both
  const flipY = hitY || !hitX;
  const bounces = b.bounces + 1;
  const bullet: BulletBody = {
    x: flipX ? b.x : nx,
    y: flipY ? b.y : ny,
    vx: flipX ? -b.vx : b.vx,
    vy: flipY ? -b.vy : b.vy,
    bounces,
  };
  return { bullet, alive: bounces <= maxBounces };
}

/** Move a bullet for a whole tick in sub-steps of at most BULLET_MAX_SUBSTEP px. */
export function stepBullet(
  b: BulletBody,
  dt: number,
  grid: CollisionGrid,
  maxBounces: number = BULLET_MAX_BOUNCES,
): { bullet: BulletBody; alive: boolean } {
  const n = bulletSubsteps(Math.hypot(b.vx, b.vy), dt);
  let cur = b;
  for (let i = 0; i < n; i++) {
    const r = stepBulletOnce(cur, dt / n, grid, maxBounces);
    if (!r.alive) return r;
    cur = r.bullet;
  }
  return { bullet: cur, alive: true };
}

/** True when a bullet centre is within a tank's hit circle. */
export function bulletHitsTank(bullet: Point, tank: Point, tankRadius: number = TANK_RADIUS, bulletRadius: number = BULLET_RADIUS): boolean {
  return Math.hypot(bullet.x - tank.x, bullet.y - tank.y) <= tankRadius + bulletRadius;
}

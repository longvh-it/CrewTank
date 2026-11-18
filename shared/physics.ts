import type { PlayerInput } from './types';
import type { TankStats } from './constants';
import { WORLD_HEIGHT, WORLD_WIDTH } from './constants';

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

/**
 * Advance one tank by `dt` seconds. Pure: returns a new pose.
 * `move` steers the body (driver), `aim` turns the turret (gunner). Missing parts keep their value.
 * Clamped to the world rectangle (map collision arrives in step 4).
 */
export function moveTank(pose: TankPose, input: PlayerInput, stats: TankStats, dt: number): TankPose {
  let { x, y, bodyAngle, turretAngle } = pose;
  if (input.move) {
    bodyAngle = wrapAngle(bodyAngle + input.move.turn * stats.bodyTurnSpeed * DEG * dt);
    const dist = input.move.throttle * stats.speed * dt;
    x = Math.min(Math.max(x + Math.cos(bodyAngle) * dist, 0), WORLD_WIDTH);
    y = Math.min(Math.max(y + Math.sin(bodyAngle) * dist, 0), WORLD_HEIGHT);
  }
  if (input.aim) {
    turretAngle = rotateToward(turretAngle, input.aim.angle, stats.turretTurnSpeed * DEG * dt);
  }
  return { x, y, bodyAngle, turretAngle };
}

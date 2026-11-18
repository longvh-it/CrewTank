import { CLOCK_SYNC_SMOOTHING, INTERP_DELAY_MS, INTERP_BUFFER_SIZE } from '@crew-tanks/shared/constants';
import { wrapAngle } from '@crew-tanks/shared/physics';
import type { GameSnapshot, TankState } from '@crew-tanks/shared/types';

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Interpolate angles (radians) along the shortest arc. */
export function lerpAngle(a: number, b: number, t: number): number {
  return wrapAngle(a + wrapAngle(b - a) * t);
}

export function lerpTank(a: TankState, b: TankState, t: number): TankState {
  return {
    ...b,
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    bodyAngle: lerpAngle(a.bodyAngle, b.bodyAngle, t),
    turretAngle: lerpAngle(a.turretAngle, b.turretAngle, t),
  };
}

/** Blend two snapshots; tanks that only exist in `b` (just joined) are taken as-is. */
export function lerpSnapshot(a: GameSnapshot, b: GameSnapshot, t: number): GameSnapshot {
  const before = new Map(a.tanks.map((tank) => [tank.id, tank]));
  return {
    ...b,
    t: lerp(a.t, b.t, t),
    tanks: b.tanks.map((tank) => {
      const prev = before.get(tank.id);
      return prev ? lerpTank(prev, tank, t) : tank;
    }),
  };
}

/** Buffers snapshots and samples the world at (server time − INTERP_DELAY_MS). */
export class Interpolator {
  private readonly buffer: GameSnapshot[] = [];
  private offset: number | null = null; // serverTime − clientTime, smoothed

  push(snapshot: GameSnapshot, nowMs: number): void {
    const sample = snapshot.t - nowMs;
    this.offset = this.offset === null ? sample : lerp(this.offset, sample, CLOCK_SYNC_SMOOTHING);
    this.buffer.push(snapshot);
    if (this.buffer.length > INTERP_BUFFER_SIZE) this.buffer.shift();
  }

  sample(nowMs: number): GameSnapshot | null {
    const first = this.buffer[0];
    const last = this.buffer[this.buffer.length - 1];
    if (!first || !last || this.offset === null) return null;
    const renderT = nowMs + this.offset - INTERP_DELAY_MS;
    if (renderT <= first.t) return first;
    if (renderT >= last.t) return last;
    for (let i = this.buffer.length - 1; i > 0; i--) {
      const b = this.buffer[i];
      const a = this.buffer[i - 1];
      if (a && b && a.t <= renderT) return lerpSnapshot(a, b, (renderT - a.t) / (b.t - a.t));
    }
    return last;
  }
}

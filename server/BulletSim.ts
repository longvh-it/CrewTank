import {
  BARREL_LENGTH,
  BULLET_LIFETIME_SEC,
  BULLET_SPEED,
  EXPLOSIVE_RADIUS,
  FRIENDLY_FIRE,
  SMOKE_DURATION_SEC,
  SMOKE_RADIUS,
} from '@crew-tanks/shared/constants';
import type { CollisionGrid } from '@crew-tanks/shared/map';
import { bulletHitsTank, bulletSubsteps, stepBulletOnce, type BulletBody } from '@crew-tanks/shared/physics';
import { AMMO_PROFILE, tanksInBlast } from '@crew-tanks/shared/specials';
import type { AmmoKind, BulletState, GameEvent, SmokeZone, TankState, TeamId } from '@crew-tanks/shared/types';

interface Bullet extends BulletBody {
  id: string;
  ownerId: string;
  team: TeamId;
  kind: AmmoKind;
  expiresAt: number;
}

export interface BulletHooks {
  tanks(): Iterable<TankState>;
  /** Apply damage from a shell (the game decides about invulnerability, kills and stats). */
  hit(victim: TankState, ownerId: string, dmg: number, now: number): void;
  emit(e: GameEvent): void;
}

/** Shells in flight and smoke zones: sub-stepped movement, wall bounces, direct hits, blasts. */
export class BulletSim {
  private readonly bullets: Bullet[] = [];
  private smokes: SmokeZone[] = [];
  private nextBulletId = 1;
  private nextSmokeId = 1;

  constructor(
    private readonly grid: CollisionGrid,
    private readonly hooks: BulletHooks,
  ) {}

  spawn(tank: TankState, kind: AmmoKind, now: number): void {
    const dx = Math.cos(tank.turretAngle);
    const dy = Math.sin(tank.turretAngle);
    this.bullets.push({
      id: `b${this.nextBulletId++}`,
      ownerId: tank.id,
      team: tank.team,
      kind,
      x: tank.x + dx * BARREL_LENGTH,
      y: tank.y + dy * BARREL_LENGTH,
      vx: dx * BULLET_SPEED,
      vy: dy * BULLET_SPEED,
      bounces: 0,
      expiresAt: now + BULLET_LIFETIME_SEC * 1000,
    });
  }

  step(dt: number, now: number): void {
    this.smokes = this.smokes.filter((s) => s.endsAt > now);
    const n = bulletSubsteps(BULLET_SPEED, dt);
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      if (!bullet) continue;
      const profile = AMMO_PROFILE[bullet.kind];
      let done = now >= bullet.expiresAt;
      for (let k = 0; !done && k < n; k++) {
        const r = stepBulletOnce(bullet, dt / n, this.grid, profile.maxBounces);
        Object.assign(bullet, r.bullet);
        if (!r.alive) done = true;
        else if (this.tankInPath(bullet, now)) {
          done = true;
        }
      }
      if (done) {
        this.bullets.splice(i, 1);
        if (profile.detonates) this.detonate(bullet, now);
      }
    }
  }

  /** Direct hit: normal/piercing shells hurt the tank; detonating shells just stop (and go off). */
  private tankInPath(bullet: Bullet, now: number): boolean {
    for (const tank of this.hooks.tanks()) {
      if (!tank.alive || tank.id === bullet.ownerId) continue;
      if (!FRIENDLY_FIRE && tank.team === bullet.team) continue;
      if (!bulletHitsTank(bullet, tank)) continue;
      const profile = AMMO_PROFILE[bullet.kind];
      if (!profile.detonates) this.hooks.hit(tank, bullet.ownerId, profile.damage, now);
      return true;
    }
    return false;
  }

  private detonate(bullet: Bullet, now: number): void {
    if (bullet.kind === 'explosive') {
      const tanks = [...this.hooks.tanks()];
      for (const id of tanksInBlast(bullet, EXPLOSIVE_RADIUS, tanks, bullet.team, FRIENDLY_FIRE)) {
        const victim = tanks.find((t) => t.id === id);
        if (victim) this.hooks.hit(victim, bullet.ownerId, AMMO_PROFILE.explosive.damage, now);
      }
      this.hooks.emit({ type: 'explode', x: bullet.x, y: bullet.y, r: EXPLOSIVE_RADIUS });
    } else if (bullet.kind === 'smoke') {
      this.smokes.push({
        id: `s${this.nextSmokeId++}`,
        x: bullet.x,
        y: bullet.y,
        r: SMOKE_RADIUS,
        endsAt: now + SMOKE_DURATION_SEC * 1000,
      });
    }
  }

  bulletStates(): BulletState[] {
    return this.bullets.map((b) => ({ id: b.id, x: b.x, y: b.y, kind: b.kind }));
  }

  smokeZones(): SmokeZone[] {
    return this.smokes.map((s) => ({ ...s }));
  }
}

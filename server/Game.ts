import {
  BARREL_LENGTH,
  BULLET_DAMAGE,
  BULLET_LIFETIME_SEC,
  BULLET_MAX_BOUNCES,
  BULLET_SPEED,
  FRIENDLY_FIRE,
  RESPAWN_DELAY_SEC,
  SNAPSHOT_HZ,
  SPAWN_INVULNERABLE_SEC,
  TANK_STATS,
  TICK_HZ,
} from '@crew-tanks/shared/constants';
import type { MapData } from '@crew-tanks/shared/map';
import {
  bulletHitsTank,
  bulletSubsteps,
  collideTanks,
  collideWalls,
  moveTank,
  stepBulletOnce,
  type BulletBody,
} from '@crew-tanks/shared/physics';
import type { BulletState, GameEvent, GameSnapshot, PlayerInput, TankState, TeamId } from '@crew-tanks/shared/types';

/** Where a game sends its output; the server wires this to one socket.io room. */
export interface GameChannel {
  state(snapshot: GameSnapshot): void;
  event(e: GameEvent): void;
}

const STATS = TANK_STATS[1];
const NO_INPUT: PlayerInput = { seq: 0, swap: false };

interface Bullet extends BulletBody {
  id: string;
  ownerId: string;
  team: TeamId;
  expiresAt: number;
}

/** One game per room, one 1-crew tank per socket (step 7b: per TankSlot). Server owns positions, bullets, HP and respawns. */
export class Game {
  private readonly tanks = new Map<string, TankState>();
  private readonly inputs = new Map<string, PlayerInput>();
  private readonly spawnCount = { red: 0, blue: 0 };
  private readonly bullets: Bullet[] = [];
  private readonly lastShotAt = new Map<string, number>();
  private nextTeam = 0;
  private nextBulletId = 1;
  private tickTimer: NodeJS.Timeout | null = null;
  private snapshotTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly channel: GameChannel,
    private readonly map: MapData,
  ) {}

  start(): void {
    this.tickTimer = setInterval(() => this.tick(1 / TICK_HZ), 1000 / TICK_HZ);
    this.snapshotTimer = setInterval(() => this.channel.state(this.snapshot()), 1000 / SNAPSHOT_HZ);
  }

  stop(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);
    this.tickTimer = this.snapshotTimer = null;
  }

  addTank(id: string): void {
    const team = (this.nextTeam++ % 2 === 0 ? 'red' : 'blue') as TeamId;
    const points = this.map.spawns[team];
    this.tanks.set(id, {
      id,
      team,
      x: 0,
      y: 0,
      bodyAngle: 0,
      turretAngle: 0,
      hp: STATS.maxHp,
      maxHp: STATS.maxHp,
      alive: true,
      respawnAt: null,
      crew: 1,
      specialAmmo: 0,
      specialKind: null,
      boostReadyAt: 0,
      invulnerableUntil: 0,
    });
    const tank = this.tanks.get(id);
    if (tank) this.spawn(tank);
  }

  /** Place a tank on the next spawn point of its team (also used on respawn). */
  private spawn(tank: TankState): void {
    const points = this.map.spawns[tank.team];
    const p = points[this.spawnCount[tank.team]++ % points.length];
    if (!p) throw new Error(`Map has no spawn points for team ${tank.team}`);
    tank.x = p.x;
    tank.y = p.y;
    tank.bodyAngle = tank.team === 'red' ? 0 : Math.PI;
    tank.turretAngle = tank.bodyAngle;
  }

  removeTank(id: string): void {
    this.tanks.delete(id);
    this.inputs.delete(id);
    this.lastShotAt.delete(id);
  }

  /** Test hooks: place a tank / set invulnerability without going through input. */
  teleport(id: string, x: number, y: number): void {
    const t = this.tanks.get(id);
    if (t) {
      t.x = x;
      t.y = y;
    }
  }

  setInvulnerable(id: string, until: number): void {
    const t = this.tanks.get(id);
    if (t) t.invulnerableUntil = until;
  }

  setInput(id: string, input: PlayerInput): void {
    if (this.tanks.has(id)) this.inputs.set(id, input);
  }

  tick(dt: number, now: number = Date.now()): void {
    this.respawnDue(now);
    const all = [...this.tanks.values()].filter((t) => t.alive);
    for (const tank of all) {
      const pose = moveTank(tank, this.inputs.get(tank.id) ?? NO_INPUT, STATS, dt, this.map.grid);
      tank.x = pose.x;
      tank.y = pose.y;
      tank.bodyAngle = pose.bodyAngle;
      tank.turretAngle = pose.turretAngle;
    }
    // tank-vs-tank separation, then re-resolve walls so a push never leaves a tank inside one
    const apart = collideTanks(all);
    all.forEach((tank, i) => {
      const p = apart[i];
      if (!p) return;
      const r = collideWalls(p, this.map.grid);
      tank.x = r.x;
      tank.y = r.y;
    });
    for (const tank of all) this.maybeFire(tank, now);
    this.stepBullets(dt, now);
  }

  private respawnDue(now: number): void {
    for (const tank of this.tanks.values()) {
      if (tank.alive || tank.respawnAt === null || now < tank.respawnAt) continue;
      this.spawn(tank);
      tank.hp = tank.maxHp;
      tank.alive = true;
      tank.respawnAt = null;
      tank.invulnerableUntil = now + SPAWN_INVULNERABLE_SEC * 1000;
    }
  }

  private maybeFire(tank: TankState, now: number): void {
    if (!this.inputs.get(tank.id)?.aim?.fire) return;
    const last = this.lastShotAt.get(tank.id) ?? -Infinity;
    if (now - last < STATS.reloadSec * 1000) return;
    this.lastShotAt.set(tank.id, now);
    const dx = Math.cos(tank.turretAngle);
    const dy = Math.sin(tank.turretAngle);
    this.bullets.push({
      id: `b${this.nextBulletId++}`,
      ownerId: tank.id,
      team: tank.team,
      x: tank.x + dx * BARREL_LENGTH,
      y: tank.y + dy * BARREL_LENGTH,
      vx: dx * BULLET_SPEED,
      vy: dy * BULLET_SPEED,
      bounces: 0,
      expiresAt: now + BULLET_LIFETIME_SEC * 1000,
    });
  }

  private stepBullets(dt: number, now: number): void {
    const n = bulletSubsteps(BULLET_SPEED, dt);
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      if (!bullet) continue;
      let alive = now < bullet.expiresAt;
      for (let k = 0; alive && k < n; k++) {
        const r = stepBulletOnce(bullet, dt / n, this.map.grid, BULLET_MAX_BOUNCES);
        Object.assign(bullet, r.bullet);
        alive = r.alive && !this.hitTank(bullet, now);
      }
      if (!alive) this.bullets.splice(i, 1);
    }
  }

  /** Returns true when the bullet was consumed by a tank. */
  private hitTank(bullet: Bullet, now: number): boolean {
    for (const tank of this.tanks.values()) {
      if (!tank.alive || tank.id === bullet.ownerId) continue;
      if (!FRIENDLY_FIRE && tank.team === bullet.team) continue;
      if (!bulletHitsTank(bullet, tank)) continue;
      if (now >= tank.invulnerableUntil) this.damage(tank, bullet.ownerId, BULLET_DAMAGE, now);
      return true;
    }
    return false;
  }

  private damage(tank: TankState, killerId: string, dmg: number, now: number): void {
    tank.hp = Math.max(0, tank.hp - dmg);
    this.emit({ type: 'hit', tankId: tank.id, dmg });
    if (tank.hp > 0) return;
    tank.alive = false;
    tank.respawnAt = now + RESPAWN_DELAY_SEC * 1000;
    this.emit({ type: 'kill', killerTankId: killerId, victimTankId: tank.id });
  }

  private emit(e: GameEvent): void {
    this.channel.event(e);
  }

  snapshot(): GameSnapshot {
    return {
      t: Date.now(),
      tanks: [...this.tanks.values()].map((t) => ({ ...t })),
      bullets: this.bullets.map((b): BulletState => ({ id: b.id, x: b.x, y: b.y, kind: 'normal' })),
      pickups: [],
      smokes: [],
      score: { red: 0, blue: 0 },
      endsAt: 0,
    };
  }
}

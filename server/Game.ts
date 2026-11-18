import {
  BARREL_LENGTH,
  BULLET_DAMAGE,
  BULLET_LIFETIME_SEC,
  BULLET_MAX_BOUNCES,
  BULLET_SPEED,
  DEFAULT_KILL_LIMIT,
  DEFAULT_TIME_LIMIT_SEC,
  FRIENDLY_FIRE,
  RESPAWN_DELAY_SEC,
  SNAPSHOT_HZ,
  SPAWN_INVULNERABLE_SEC,
  TANK_STATS,
  TICK_HZ,
  type TankStats,
} from '@crew-tanks/shared/constants';
import type { MapData } from '@crew-tanks/shared/map';
import { evaluateMatch } from '@crew-tanks/shared/match';
import {
  bulletHitsTank,
  bulletSubsteps,
  collideTanks,
  collideWalls,
  moveTank,
  stepBulletOnce,
  type BulletBody,
} from '@crew-tanks/shared/physics';
import type { BulletState, GameEvent, GameSnapshot, MatchResult, PlayerInput, Seat, TankState, TeamId } from '@crew-tanks/shared/types';
import { Stats } from './Stats';

export interface TankSpec {
  id: string;
  team: TeamId;
  crew: 1 | 2;
  hpBonus?: number;
  driverId: string | null;
  gunnerId: string | null;
}

export interface GameOptions {
  killLimit: number;
  timeLimitSec: number;
}

/** Where a game sends its output; the server wires this to one socket.io room. */
export interface GameChannel {
  state(snapshot: GameSnapshot): void;
  event(e: GameEvent): void;
  end(result: MatchResult): void;
}

const NO_INPUT: PlayerInput = { seq: 0, swap: false };

interface Bullet extends BulletBody {
  id: string;
  ownerId: string;
  team: TeamId;
  expiresAt: number;
}

/** One game per room, one tank per lobby TankSlot. Server owns positions, bullets, HP and respawns. */
export class Game {
  private readonly tanks = new Map<string, TankState>();
  private readonly inputs = new Map<string, PlayerInput>();
  private readonly stats = new Map<string, TankStats>();
  private readonly spawnCount = { red: 0, blue: 0 };
  private readonly bullets: Bullet[] = [];
  private readonly lastShotAt = new Map<string, number>();
  private readonly score: Record<TeamId, number> = { red: 0, blue: 0 };
  private readonly statsBook = new Stats();
  private startedAt: number | null = null;
  private endsAt = 0;
  private ended = false;
  private nextBulletId = 1;
  private tickTimer: NodeJS.Timeout | null = null;
  private snapshotTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly channel: GameChannel,
    private readonly map: MapData,
    private readonly options: GameOptions = { killLimit: DEFAULT_KILL_LIMIT, timeLimitSec: DEFAULT_TIME_LIMIT_SEC },
  ) {}

  /** Start the match clock (also called by `start`). */
  beginMatch(now: number = Date.now()): void {
    this.startedAt = now;
    this.endsAt = now + this.options.timeLimitSec * 1000;
  }

  start(): void {
    this.beginMatch();
    this.tickTimer = setInterval(() => this.tick(1 / TICK_HZ), 1000 / TICK_HZ);
    this.snapshotTimer = setInterval(() => this.channel.state(this.snapshot()), 1000 / SNAPSHOT_HZ);
  }

  stop(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);
    this.tickTimer = this.snapshotTimer = null;
  }

  /** Add a tank for one lobby slot. `hpBonus` is a fraction (0.2 = +20% HP). */
  addTank({ id, team, crew, hpBonus = 0, driverId, gunnerId }: TankSpec): void {
    this.statsBook.registerTank({ id, driverId, gunnerId });
    const stats = TANK_STATS[crew];
    const maxHp = Math.round(stats.maxHp * (1 + hpBonus));
    this.stats.set(id, stats);
    this.tanks.set(id, {
      id,
      team,
      x: 0,
      y: 0,
      bodyAngle: 0,
      turretAngle: 0,
      hp: maxHp,
      maxHp,
      alive: true,
      respawnAt: null,
      crew,
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
    this.stats.delete(id);
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

  /**
   * Store a player's input for their tank. In a 2-crew tank `move` only comes from the driver
   * and `aim` only from the gunner; a solo tank takes both from its one player.
   */
  setInput(tankId: string, seat: Seat, input: PlayerInput): void {
    const tank = this.tanks.get(tankId);
    if (!tank) return;
    if (tank.crew === 1) {
      this.inputs.set(tankId, input);
      return;
    }
    const prev = this.inputs.get(tankId) ?? NO_INPUT;
    const next: PlayerInput = { ...prev, seq: input.seq };
    if (seat === 'driver') {
      if (input.move) next.move = input.move;
      else delete next.move;
    } else if (input.aim) next.aim = input.aim;
    else delete next.aim;
    this.inputs.set(tankId, next);
  }

  tick(dt: number, now: number = Date.now()): void {
    if (this.ended) return;
    this.respawnDue(now);
    const all = [...this.tanks.values()].filter((t) => t.alive);
    for (const tank of all) {
      const pose = moveTank(tank, this.inputs.get(tank.id) ?? NO_INPUT, this.statsOf(tank.id), dt, this.map.grid);
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
    this.checkEnd(now);
  }

  private checkEnd(now: number): void {
    if (this.startedAt === null) return;
    const outcome = evaluateMatch({ score: this.score, killLimit: this.options.killLimit, now, endsAt: this.endsAt });
    if (!outcome.over) return;
    this.ended = true;
    this.stop();
    this.channel.state(this.snapshot());
    this.channel.end({
      winner: outcome.winner,
      score: { ...this.score },
      stats: this.statsBook.results(),
      awards: this.statsBook.awards(Math.max(0, (now - this.startedAt) / 1000)),
    });
  }

  private statsOf(tankId: string): TankStats {
    return this.stats.get(tankId) ?? TANK_STATS[1];
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
    if (now - last < this.statsOf(tank.id).reloadSec * 1000) return;
    this.lastShotAt.set(tank.id, now);
    this.statsBook.recordShot(tank.id);
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
    const before = tank.hp;
    tank.hp = Math.max(0, tank.hp - dmg);
    this.emit({ type: 'hit', tankId: tank.id, dmg });
    this.statsBook.recordHit(killerId, tank.id, before - tank.hp, now);
    if (tank.hp > 0) return;
    tank.alive = false;
    tank.respawnAt = now + RESPAWN_DELAY_SEC * 1000;
    const killer = this.tanks.get(killerId);
    if (killer) this.score[killer.team] += 1;
    this.statsBook.recordKill(killerId, tank.id, now);
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
      score: { ...this.score },
      endsAt: this.endsAt,
    };
  }
}

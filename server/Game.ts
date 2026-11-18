import {
  BOOST_SPEED,
  DEFAULT_KILL_LIMIT,
  DEFAULT_TIME_LIMIT_SEC,
  RESPAWN_DELAY_SEC,
  SEAT_SWAP_FREEZE_SEC,
  SNAPSHOT_HZ,
  SPAWN_INVULNERABLE_SEC,
  TANK_STATS,
  TICK_HZ,
  type TankStats,
} from '@crew-tanks/shared/constants';
import type { MapData } from '@crew-tanks/shared/map';
import { evaluateMatch } from '@crew-tanks/shared/match';
import { collideTanks, collideWalls, moveTank } from '@crew-tanks/shared/physics';
import { isBoosting, repairHp, stepSwapHold, takeShell, updateBoost, type BoostState, type SwapHold } from '@crew-tanks/shared/specials';
import type { AmmoKind, GameEvent, GameSnapshot, MatchResult, PlayerInput, Seat, TankState, TeamId } from '@crew-tanks/shared/types';
import { BulletSim } from './BulletSim';
import { Pickups } from './Pickups';
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
  /** The two crew of a tank traded seats (hold F together). */
  swapped(tankId: string): void;
}

const NO_INPUT: PlayerInput = { seq: 0, swap: false };

interface TankRuntime {
  boost: BoostState;
  swap: SwapHold;
  swapHeld: Record<Seat, boolean>;
  frozenUntil: number;
}

/** One game per room, one tank per lobby TankSlot. Server owns positions, bullets, HP and respawns. */
export class Game {
  private readonly tanks = new Map<string, TankState>();
  private readonly inputs = new Map<string, PlayerInput>();
  private readonly stats = new Map<string, TankStats>();
  private readonly spawnCount = { red: 0, blue: 0 };
  private readonly runtime = new Map<string, TankRuntime>();
  private readonly sim: BulletSim;
  private readonly pickups: Pickups;
  private readonly lastShotAt = new Map<string, number>();
  private readonly score: Record<TeamId, number> = { red: 0, blue: 0 };
  private readonly statsBook = new Stats();
  private startedAt: number | null = null;
  private endsAt = 0;
  private ended = false;
  private tickTimer: NodeJS.Timeout | null = null;
  private snapshotTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly channel: GameChannel,
    private readonly map: MapData,
    private readonly options: GameOptions = { killLimit: DEFAULT_KILL_LIMIT, timeLimitSec: DEFAULT_TIME_LIMIT_SEC },
  ) {
    this.sim = new BulletSim(map.grid, {
      tanks: () => this.tanks.values(),
      hit: (victim, ownerId, dmg, now) => this.damage(victim, ownerId, dmg, now),
      emit: (e) => this.emit(e),
    });
    this.pickups = new Pickups(map.pickups);
  }

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
    this.runtime.set(id, { boost: { boostUntil: 0, readyAt: 0 }, swap: { heldSec: 0, latched: false }, swapHeld: { driver: false, gunner: false }, frozenUntil: 0 });
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
    this.runtime.delete(id);
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

  /** Test hooks: hand a tank shells / deal damage directly. */
  giveShells(id: string, kind: AmmoKind, count: number): void {
    const t = this.tanks.get(id);
    if (t) {
      t.specialKind = kind;
      t.specialAmmo = count;
    }
  }

  damageForTest(id: string, dmg: number, byTankId: string): void {
    const t = this.tanks.get(id);
    if (t) this.damage(t, byTankId, dmg, Date.now() + 1e9);
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
    const rt = this.runtime.get(tankId);
    if (rt && tank.crew === 2) rt.swapHeld[seat] = input.swap;
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
    for (const tank of all) this.driveTank(tank, dt, now);
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
    this.pickups.step(all, now, (e) => this.emit(e));
    this.sim.step(dt, now);
    this.checkEnd(now);
  }

  /** Movement, boost, repair and seat swapping for one live tank. */
  private driveTank(tank: TankState, dt: number, now: number): void {
    const rt = this.runtime.get(tank.id);
    const frozen = rt !== undefined && now < rt.frozenUntil;
    const input = frozen ? NO_INPUT : (this.inputs.get(tank.id) ?? NO_INPUT);
    let stats = this.statsOf(tank.id);
    if (rt) {
      rt.boost = updateBoost(rt.boost, input.move?.boost === true, stats.canBoost, now);
      tank.boostReadyAt = rt.boost.readyAt;
      if (isBoosting(rt.boost, now)) stats = { ...stats, speed: BOOST_SPEED };
      if (tank.crew === 2) {
        const r = stepSwapHold(rt.swap, rt.swapHeld.driver, rt.swapHeld.gunner, dt);
        rt.swap = r.state;
        if (r.triggered) {
          rt.frozenUntil = now + SEAT_SWAP_FREEZE_SEC * 1000;
          this.statsBook.swapSeats(tank.id);
          this.channel.swapped(tank.id);
        }
      }
    }
    const pose = moveTank(tank, input, stats, dt, this.map.grid);
    const moving = input.move !== undefined && (input.move.throttle !== 0 || input.move.turn !== 0);
    tank.hp = repairHp(tank.hp, tank.maxHp, dt, input.move?.repair === true, moving);
    tank.x = pose.x;
    tank.y = pose.y;
    tank.bodyAngle = pose.bodyAngle;
    tank.turretAngle = pose.turretAngle;
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
      tank.specialAmmo = 0;
      tank.specialKind = null;
    }
  }

  private maybeFire(tank: TankState, now: number): void {
    const rt = this.runtime.get(tank.id);
    if (rt && now < rt.frozenUntil) return;
    const aim = this.inputs.get(tank.id)?.aim;
    if (!aim?.fire && !aim?.special) return;
    const last = this.lastShotAt.get(tank.id) ?? -Infinity;
    if (now - last < this.statsOf(tank.id).reloadSec * 1000) return;
    this.lastShotAt.set(tank.id, now);
    const shell = takeShell(tank, aim.special);
    tank.specialAmmo = shell.specialAmmo;
    tank.specialKind = shell.specialKind;
    this.statsBook.recordShot(tank.id);
    this.sim.spawn(tank, shell.kind, now);
  }

  /** Damage from a shell; invulnerable tanks (just respawned) take none. */
    private damage(tank: TankState, killerId: string, dmg: number, now: number): void {
    if (now < tank.invulnerableUntil) return;
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
      bullets: this.sim.bulletStates(),
      pickups: this.pickups.states(),
      smokes: this.sim.smokeZones(),
      score: { ...this.score },
      endsAt: this.endsAt,
    };
  }
}

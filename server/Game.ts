import type { Server } from 'socket.io';
import {
  SNAPSHOT_HZ,
  TANK_STATS,
  TICK_HZ,
} from '@crew-tanks/shared/constants';
import type { MapData } from '@crew-tanks/shared/map';
import { collideTanks, collideWalls, moveTank } from '@crew-tanks/shared/physics';
import type { ClientToServer, GameSnapshot, PlayerInput, ServerToClient, TankState, TeamId } from '@crew-tanks/shared/types';

type GameIo = Server<ClientToServer, ServerToClient>;

const STATS = TANK_STATS[1];
const NO_INPUT: PlayerInput = { seq: 0, swap: false };

/** Step 3: one global room, one 1-crew tank per socket. Server owns all positions. */
export class Game {
  private readonly tanks = new Map<string, TankState>();
  private readonly inputs = new Map<string, PlayerInput>();
  private readonly spawnCount = { red: 0, blue: 0 };
  private nextTeam = 0;
  private tickTimer: NodeJS.Timeout | null = null;
  private snapshotTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly io: GameIo,
    private readonly map: MapData,
  ) {}

  start(): void {
    this.tickTimer = setInterval(() => this.tick(1 / TICK_HZ), 1000 / TICK_HZ);
    this.snapshotTimer = setInterval(() => this.io.emit('game:state', this.snapshot()), 1000 / SNAPSHOT_HZ);
  }

  stop(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);
    this.tickTimer = this.snapshotTimer = null;
  }

  addTank(id: string): void {
    const team = (this.nextTeam++ % 2 === 0 ? 'red' : 'blue') as TeamId;
    const points = this.map.spawns[team];
    const spawn = points[this.spawnCount[team]++ % points.length];
    if (!spawn) throw new Error(`Map has no spawn points for team ${team}`);
    this.tanks.set(id, {
      id,
      team,
      x: spawn.x,
      y: spawn.y,
      bodyAngle: team === 'red' ? 0 : Math.PI,
      turretAngle: 0,
      hp: STATS.maxHp,
      maxHp: STATS.maxHp,
      alive: true,
      respawnAt: null,
      crew: 1,
      specialAmmo: 0,
      specialKind: null,
      boostReadyAt: 0,
    });
  }

  removeTank(id: string): void {
    this.tanks.delete(id);
    this.inputs.delete(id);
  }

  setInput(id: string, input: PlayerInput): void {
    if (this.tanks.has(id)) this.inputs.set(id, input);
  }

  tick(dt: number): void {
    const all = [...this.tanks.values()];
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
  }

  snapshot(): GameSnapshot {
    return {
      t: Date.now(),
      tanks: [...this.tanks.values()].map((t) => ({ ...t })),
      bullets: [],
      pickups: [],
      smokes: [],
      score: { red: 0, blue: 0 },
      endsAt: 0,
    };
  }
}

import type { Server } from 'socket.io';
import {
  SNAPSHOT_HZ,
  TANK_STATS,
  TEMP_SPAWN_RING_RADIUS,
  TEMP_SPAWN_SLOTS,
  TICK_HZ,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '@crew-tanks/shared/constants';
import { moveTank } from '@crew-tanks/shared/physics';
import type { ClientToServer, GameSnapshot, PlayerInput, ServerToClient, TankState } from '@crew-tanks/shared/types';

type GameIo = Server<ClientToServer, ServerToClient>;

const STATS = TANK_STATS[1];
const NO_INPUT: PlayerInput = { seq: 0, swap: false };

/** Step 3: one global room, one 1-crew tank per socket. Server owns all positions. */
export class Game {
  private readonly tanks = new Map<string, TankState>();
  private readonly inputs = new Map<string, PlayerInput>();
  private spawnCount = 0;
  private tickTimer: NodeJS.Timeout | null = null;
  private snapshotTimer: NodeJS.Timeout | null = null;

  constructor(private readonly io: GameIo) {}

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
    const angle = (this.spawnCount++ % TEMP_SPAWN_SLOTS) * ((Math.PI * 2) / TEMP_SPAWN_SLOTS);
    this.tanks.set(id, {
      id,
      team: this.spawnCount % 2 === 0 ? 'blue' : 'red',
      x: WORLD_WIDTH / 2 + Math.cos(angle) * TEMP_SPAWN_RING_RADIUS,
      y: WORLD_HEIGHT / 2 + Math.sin(angle) * TEMP_SPAWN_RING_RADIUS,
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
    for (const tank of this.tanks.values()) {
      const pose = moveTank(tank, this.inputs.get(tank.id) ?? NO_INPUT, STATS, dt);
      tank.x = pose.x;
      tank.y = pose.y;
      tank.bodyAngle = pose.bodyAngle;
      tank.turretAngle = pose.turretAngle;
    }
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

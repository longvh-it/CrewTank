import Phaser from 'phaser';
import {
  BARREL_LENGTH,
  BARREL_WIDTH,
  TANK_BODY_LENGTH,
  TANK_BODY_WIDTH,
  TANK_STATS,
  TURRET_RADIUS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '@crew-tanks/shared/constants';
import { InputController } from './InputController';

const DEG = Math.PI / 180;
const STATS = TANK_STATS[1];

/** Rotate `from` toward `to` by at most `maxStep` radians along the shortest arc. */
function rotateToward(from: number, to: number, maxStep: number): number {
  const diff = Phaser.Math.Angle.Wrap(to - from);
  if (Math.abs(diff) <= maxStep) return to;
  return from + Math.sign(diff) * maxStep;
}

/**
 * Step 2: one placeholder tank driven locally. Step 3 replaces local movement
 * with server snapshots; the client will then only send `PlayerInput`.
 */
export class BattleScene extends Phaser.Scene {
  private input$!: InputController;
  private body$!: Phaser.GameObjects.Rectangle;
  private turret!: Phaser.GameObjects.Container;
  private bodyAngle = 0;
  private turretAngle = 0;

  constructor() {
    super('battle');
  }

  create(): void {
    this.input$ = new InputController(this);
    const x = WORLD_WIDTH / 2;
    const y = WORLD_HEIGHT / 2;

    this.body$ = this.add.rectangle(x, y, TANK_BODY_LENGTH, TANK_BODY_WIDTH, 0xc0392b).setStrokeStyle(2, 0x000000);
    const barrel = this.add
      .rectangle(0, 0, BARREL_LENGTH, BARREL_WIDTH, 0x2c3e50)
      .setOrigin(0, 0.5);
    const dome = this.add.circle(0, 0, TURRET_RADIUS, 0x7f8c8d).setStrokeStyle(2, 0x000000);
    this.turret = this.add.container(x, y, [barrel, dome]);
  }

  override update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    const input = this.input$.read({ x: this.turret.x, y: this.turret.y });

    if (input.move) {
      this.bodyAngle += input.move.turn * STATS.bodyTurnSpeed * DEG * dt;
      const dist = input.move.throttle * STATS.speed * dt;
      this.body$.x = Phaser.Math.Clamp(this.body$.x + Math.cos(this.bodyAngle) * dist, 0, WORLD_WIDTH);
      this.body$.y = Phaser.Math.Clamp(this.body$.y + Math.sin(this.bodyAngle) * dist, 0, WORLD_HEIGHT);
    }
    if (input.aim) {
      this.turretAngle = rotateToward(this.turretAngle, input.aim.angle, STATS.turretTurnSpeed * DEG * dt);
    }

    this.body$.rotation = this.bodyAngle;
    this.turret.setPosition(this.body$.x, this.body$.y);
    this.turret.rotation = this.turretAngle;
  }
}

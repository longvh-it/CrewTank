import Phaser from 'phaser';
import {
  BARREL_LENGTH,
  BARREL_WIDTH,
  INPUT_SEND_HZ,
  TANK_BODY_LENGTH,
  TANK_BODY_WIDTH,
  TURRET_RADIUS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '@crew-tanks/shared/constants';
import type { GameSnapshot, TankState } from '@crew-tanks/shared/types';
import type { GameSocket } from '../net/socket';
import { InputController } from './InputController';
import { Interpolator } from './Interpolator';

const OWN_COLOR = 0x2980b9;
const OTHER_COLOR = 0xc0392b;

interface TankView {
  body: Phaser.GameObjects.Rectangle;
  turret: Phaser.GameObjects.Container;
}

/**
 * Renders server snapshots only (interpolated). The client never moves a tank:
 * it sends `PlayerInput` at INPUT_SEND_HZ and draws what the server says.
 */
export class BattleScene extends Phaser.Scene {
  private input$!: InputController;
  private readonly interpolator = new Interpolator();
  private readonly views = new Map<string, TankView>();
  private readonly onState = (s: GameSnapshot): void => this.interpolator.push(s, Date.now());

  constructor(private readonly socket: GameSocket) {
    super('battle');
  }

  create(): void {
    this.input$ = new InputController(this);
    this.socket.on('game:state', this.onState);
    this.time.addEvent({ delay: 1000 / INPUT_SEND_HZ, loop: true, callback: () => this.sendInput() });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.socket.off('game:state', this.onState));
  }

  private sendInput(): void {
    const own = this.socket.id ? this.views.get(this.socket.id) : undefined;
    const origin = own ? { x: own.turret.x, y: own.turret.y } : { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
    this.socket.emit('game:input', this.input$.read(origin));
  }

  override update(): void {
    const snap = this.interpolator.sample(Date.now());
    if (!snap) return;
    const seen = new Set<string>();
    for (const tank of snap.tanks) {
      seen.add(tank.id);
      this.applyTank(this.views.get(tank.id) ?? this.createView(tank), tank);
    }
    for (const [id, view] of this.views) {
      if (seen.has(id)) continue;
      view.body.destroy();
      view.turret.destroy();
      this.views.delete(id);
    }
  }

  private createView(tank: TankState): TankView {
    const color = tank.id === this.socket.id ? OWN_COLOR : OTHER_COLOR;
    const body = this.add.rectangle(tank.x, tank.y, TANK_BODY_LENGTH, TANK_BODY_WIDTH, color).setStrokeStyle(2, 0x000000);
    const barrel = this.add.rectangle(0, 0, BARREL_LENGTH, BARREL_WIDTH, 0x2c3e50).setOrigin(0, 0.5);
    const dome = this.add.circle(0, 0, TURRET_RADIUS, 0x7f8c8d).setStrokeStyle(2, 0x000000);
    const turret = this.add.container(tank.x, tank.y, [barrel, dome]);
    const view = { body, turret };
    this.views.set(tank.id, view);
    return view;
  }

  private applyTank(view: TankView, tank: TankState): void {
    view.body.setPosition(tank.x, tank.y).setRotation(tank.bodyAngle);
    view.turret.setPosition(tank.x, tank.y).setRotation(tank.turretAngle);
  }
}

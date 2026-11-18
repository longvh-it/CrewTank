import Phaser from 'phaser';
import {
  BARREL_LENGTH,
  BARREL_WIDTH,
  BULLET_RADIUS,
  HIT_FLASH_MS,
  HP_BAR_HEIGHT,
  HP_BAR_OFFSET_Y,
  HP_BAR_WIDTH,
  INVULNERABLE_BLINK_MS,
  INPUT_SEND_HZ,
  TANK_BODY_LENGTH,
  TANK_BODY_WIDTH,
  TURRET_RADIUS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '@crew-tanks/shared/constants';
import type { MapData } from '@crew-tanks/shared/map';
import { isSolid } from '@crew-tanks/shared/map';
import type { GameEvent, GameSnapshot, TankState } from '@crew-tanks/shared/types';
import type { GameSocket } from '../net/socket';
import { InputController } from './InputController';
import { Interpolator } from './Interpolator';
import { inputForRole, type CrewRole } from './inputRole';
import { tankLabel } from '../crew';
import { useStore } from '../store';

const OWN_COLOR = 0x2980b9;
const OTHER_COLOR = 0xc0392b;
const BULLET_COLOR = 0xf1c40f;
const FLASH_COLOR = 0xffffff;
const HP_COLOR = 0x2ecc71;
const WALL_COLOR = 0x5d5d5d;
const WALL_EDGE_COLOR = 0x3a3a3a;

interface TankView {
  body: Phaser.GameObjects.Rectangle;
  turret: Phaser.GameObjects.Container;
  hpBar: Phaser.GameObjects.Graphics;
  baseColor: number;
  flashUntil: number;
}

/**
 * Renders server snapshots only (interpolated). The client never moves a tank:
 * it sends `PlayerInput` at INPUT_SEND_HZ and draws what the server says.
 */
export class BattleScene extends Phaser.Scene {
  private input$!: InputController;
  private readonly interpolator = new Interpolator();
  private readonly views = new Map<string, TankView>();
  private readonly bulletViews = new Map<string, Phaser.GameObjects.Arc>();
  private readonly onState = (s: GameSnapshot): void => this.interpolator.push(s, Date.now());

  private readonly onEvent = (e: GameEvent): void => {
    if (e.type === 'kill') {
      const { lobby, pushKill } = useStore.getState();
      const killerTeam = lobby?.tanks.find((t) => t.id === e.killerTankId)?.team;
      if (lobby && killerTeam) {
        pushKill({ killer: tankLabel(lobby, e.killerTankId), victim: tankLabel(lobby, e.victimTankId), killerTeam });
      }
      return;
    }
    if (e.type !== 'hit') return;
    const view = this.views.get(e.tankId);
    if (view) view.flashUntil = Date.now() + HIT_FLASH_MS;
  };

  constructor(
    private readonly socket: GameSocket,
    private readonly map: MapData,
    private readonly ownTankId: string | null,
    private readonly role: CrewRole,
  ) {
    super('battle');
  }

  create(): void {
    this.drawWalls();
    this.input$ = new InputController(this);
    this.socket.on('game:state', this.onState);
    this.socket.on('game:event', this.onEvent);
    this.time.addEvent({ delay: 1000 / INPUT_SEND_HZ, loop: true, callback: () => this.sendInput() });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.socket.off('game:state', this.onState);
      this.socket.off('game:event', this.onEvent);
    });
  }

  private drawWalls(): void {
    const { grid } = this.map;
    const g = this.add.graphics();
    g.fillStyle(WALL_COLOR, 1).lineStyle(1, WALL_EDGE_COLOR, 1);
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        if (!isSolid(grid, col, row)) continue;
        g.fillRect(col * grid.tileSize, row * grid.tileSize, grid.tileSize, grid.tileSize);
        g.strokeRect(col * grid.tileSize, row * grid.tileSize, grid.tileSize, grid.tileSize);
      }
    }
    g.setDepth(-1);
  }

  private sendInput(): void {
    const own = this.ownTankId ? this.views.get(this.ownTankId) : undefined;
    const origin = own ? { x: own.turret.x, y: own.turret.y } : { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
    this.socket.emit('game:input', inputForRole(this.input$.read(origin), this.role));
  }

  override update(): void {
    const snap = this.interpolator.sample(Date.now());
    if (!snap) return;
    const now = Date.now();
    const store = useStore.getState();
    store.setScore(snap.score.red, snap.score.blue);
    if (snap.endsAt > 0) store.setRemaining(Math.max(0, Math.ceil((snap.endsAt - snap.t) / 1000)));
    const seen = new Set<string>();
    for (const tank of snap.tanks) {
      seen.add(tank.id);
      this.applyTank(this.views.get(tank.id) ?? this.createView(tank), tank, now);
      if (tank.id === this.ownTankId) useStore.getState().setHp(tank.hp, tank.maxHp);
    }
    for (const [id, view] of this.views) {
      if (seen.has(id)) continue;
      view.body.destroy();
      view.turret.destroy();
      view.hpBar.destroy();
      this.views.delete(id);
    }
    this.drawBullets(snap);
  }

  private drawBullets(snap: GameSnapshot): void {
    const seen = new Set<string>();
    for (const b of snap.bullets) {
      seen.add(b.id);
      const v = this.bulletViews.get(b.id) ?? this.add.circle(b.x, b.y, BULLET_RADIUS, BULLET_COLOR);
      v.setPosition(b.x, b.y);
      this.bulletViews.set(b.id, v);
    }
    for (const [id, v] of this.bulletViews) {
      if (seen.has(id)) continue;
      v.destroy();
      this.bulletViews.delete(id);
    }
  }

  private createView(tank: TankState): TankView {
    const color = tank.id === this.ownTankId ? OWN_COLOR : OTHER_COLOR;
    const body = this.add.rectangle(tank.x, tank.y, TANK_BODY_LENGTH, TANK_BODY_WIDTH, color).setStrokeStyle(2, 0x000000);
    const barrel = this.add.rectangle(0, 0, BARREL_LENGTH, BARREL_WIDTH, 0x2c3e50).setOrigin(0, 0.5);
    const dome = this.add.circle(0, 0, TURRET_RADIUS, 0x7f8c8d).setStrokeStyle(2, 0x000000);
    const turret = this.add.container(tank.x, tank.y, [barrel, dome]);
    const view: TankView = { body, turret, hpBar: this.add.graphics(), baseColor: color, flashUntil: 0 };
    this.views.set(tank.id, view);
    return view;
  }

  private applyTank(view: TankView, tank: TankState, now: number): void {
    const visible = tank.alive;
    view.body.setVisible(visible);
    view.turret.setVisible(visible);
    view.hpBar.setVisible(visible);
    if (!visible) return;
    view.body.setPosition(tank.x, tank.y).setRotation(tank.bodyAngle);
    view.body.setFillStyle(now < view.flashUntil ? FLASH_COLOR : view.baseColor);
    view.turret.setPosition(tank.x, tank.y).setRotation(tank.turretAngle);
    const blink = now < tank.invulnerableUntil && Math.floor(now / INVULNERABLE_BLINK_MS) % 2 === 0;
    const alpha = blink ? 0.4 : 1;
    view.body.setAlpha(alpha);
    view.turret.setAlpha(alpha);
    const left = tank.x - HP_BAR_WIDTH / 2;
    const top = tank.y - HP_BAR_OFFSET_Y;
    view.hpBar.clear();
    view.hpBar.fillStyle(0x000000, 0.6).fillRect(left - 1, top - 1, HP_BAR_WIDTH + 2, HP_BAR_HEIGHT + 2);
    view.hpBar.fillStyle(HP_COLOR, 1).fillRect(left, top, HP_BAR_WIDTH * Math.max(0, tank.hp / tank.maxHp), HP_BAR_HEIGHT);
  }
}

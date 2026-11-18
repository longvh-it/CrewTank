import Phaser from 'phaser';
import {
  BARREL_PIVOT_Y,
  BARREL_SPRITE_SCALE,
  HIT_FLASH_MS,
  HIT_SHAKE_INTENSITY,
  HIT_SHAKE_MS,
  KILL_EXPLOSION_RADIUS,
  SPRITE_FACING_OFFSET,
  TANK_SPRITE_SCALE,
  HP_BAR_HEIGHT,
  HP_BAR_OFFSET_Y,
  HP_BAR_WIDTH,
  INVULNERABLE_BLINK_MS,
  INPUT_SEND_HZ,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '@crew-tanks/shared/constants';
import type { MapData } from '@crew-tanks/shared/map';
import { isSolid } from '@crew-tanks/shared/map';
import type { GameEvent, GameSnapshot, TankState } from '@crew-tanks/shared/types';
import type { GameSocket } from '../net/socket';
import { InputController } from './InputController';
import { Interpolator } from './Interpolator';
import { playSfx, WorldView } from './WorldView';
import { preloadAssets, SOUND, TEXTURE } from './assets';
import { hiddenBySmoke } from '@crew-tanks/shared/specials';
import { inputForRole, type CrewRole } from './inputRole';
import { tankLabel } from '../crew';
import { useStore } from '../store';

const OWN_MARKER_RADIUS = 24;
const HP_COLOR = 0x2ecc71;
const WALL_COLOR = 0x5d5d5d;
const WALL_EDGE_COLOR = 0x3a3a3a;

interface TankView {
  body: Phaser.GameObjects.Image;
  turret: Phaser.GameObjects.Image;
  hpBar: Phaser.GameObjects.Graphics;
  /** White ring under your own tank. */
  marker: Phaser.GameObjects.Arc | null;
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
  private world!: WorldView;
  private role: CrewRole;
  private readonly onState = (s: GameSnapshot): void => this.interpolator.push(s, Date.now());

  private readonly onEvent = (e: GameEvent): void => {
    if (e.type === 'kill') {
      const { lobby, pushKill } = useStore.getState();
      const killerTeam = lobby?.tanks.find((t) => t.id === e.killerTankId)?.team;
      if (lobby && killerTeam) {
        pushKill({ killer: tankLabel(lobby, e.killerTankId), victim: tankLabel(lobby, e.victimTankId), killerTeam });
      }
      const victim = this.views.get(e.victimTankId);
      if (victim) this.world.explode(victim.body.x, victim.body.y, KILL_EXPLOSION_RADIUS);
      playSfx(this, SOUND.kill);
      return;
    }
    if (e.type === 'explode') {
      this.world.explode(e.x, e.y, e.r);
      playSfx(this, SOUND.explosion);
      return;
    }
    if (e.type === 'pickup') {
      if (e.tankId === this.ownTankId) playSfx(this, SOUND.pickup);
      return;
    }
    if (e.type !== 'hit') return;
    const view = this.views.get(e.tankId);
    if (view) view.flashUntil = Date.now() + HIT_FLASH_MS;
    if (e.tankId === this.ownTankId) this.cameras.main.shake(HIT_SHAKE_MS, HIT_SHAKE_INTENSITY);
  };

  constructor(
    private readonly socket: GameSocket,
    private readonly map: MapData,
    private readonly ownTankId: string | null,
    role: CrewRole,
  ) {
    super('battle');
    this.role = role;
  }

  /** Seats can be swapped mid-match (hold F): the new role applies without restarting the scene. */
  setRole(role: CrewRole): void {
    this.role = role;
  }

  preload(): void {
    preloadAssets(this.load);
  }

  create(): void {
    this.add.tileSprite(0, 0, WORLD_WIDTH, WORLD_HEIGHT, TEXTURE.grass).setOrigin(0).setDepth(-2);
    this.drawWalls();
    this.world = new WorldView(this);
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
    const ownTeam = snap.tanks.find((t) => t.id === this.ownTankId)?.team ?? null;
    for (const tank of snap.tanks) {
      seen.add(tank.id);
      const hidden = hiddenBySmoke(ownTeam, tank, snap.smokes);
      this.applyTank(this.views.get(tank.id) ?? this.createView(tank), tank, now, hidden);
      if (tank.id === this.ownTankId) store.setOwn(tank.hp, tank.maxHp, tank.specialKind, tank.specialAmmo);
    }
    for (const [id, view] of this.views) {
      if (seen.has(id)) continue;
      view.body.destroy();
      view.turret.destroy();
      view.hpBar.destroy();
      view.marker?.destroy();
      this.views.delete(id);
    }
    this.world.update(snap);
  }

  private createView(tank: TankState): TankView {
    const own = tank.id === this.ownTankId;
    const body = this.add.image(tank.x, tank.y, TEXTURE.tank(tank.team)).setScale(TANK_SPRITE_SCALE);
    const marker = own ? this.add.circle(tank.x, tank.y, OWN_MARKER_RADIUS).setStrokeStyle(2, 0xffffff, 0.9).setDepth(-0.1) : null;
    const turret = this.add
      .image(tank.x, tank.y, TEXTURE.barrel(tank.team))
      .setScale(BARREL_SPRITE_SCALE)
      .setOrigin(0.5, BARREL_PIVOT_Y)
      .setDepth(1);
    const view: TankView = { body, turret, hpBar: this.add.graphics().setDepth(2), marker, flashUntil: 0 };
    this.views.set(tank.id, view);
    return view;
  }

  private applyTank(view: TankView, tank: TankState, now: number, hidden: boolean): void {
    const visible = tank.alive && !hidden;
    view.body.setVisible(visible);
    view.turret.setVisible(visible);
    view.hpBar.setVisible(visible);
    view.marker?.setVisible(visible);
    if (!visible) return;
    view.marker?.setPosition(tank.x, tank.y);
    view.body.setPosition(tank.x, tank.y).setRotation(tank.bodyAngle + SPRITE_FACING_OFFSET);
    view.turret.setPosition(tank.x, tank.y).setRotation(tank.turretAngle + SPRITE_FACING_OFFSET);
    if (now < view.flashUntil) {
      view.body.setTintFill(0xffffff);
      view.turret.setTintFill(0xffffff);
    } else {
      view.body.clearTint();
      view.turret.clearTint();
    }
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

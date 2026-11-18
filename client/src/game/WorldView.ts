import Phaser from 'phaser';
import {
  BULLET_SPRITE_SCALE,
  EXPLOSION_FRAMES,
  EXPLOSION_FRAME_MS,
  EXPLOSION_SPRITE_PX,
  PICKUP_RADIUS,
  SFX_VOLUME,
  SPRITE_FACING_OFFSET,
} from '@crew-tanks/shared/constants';
import type { GameSnapshot, PickupState } from '@crew-tanks/shared/types';
import { useStore } from '../store';
import { SOUND, TEXTURE } from './assets';

const PICKUP_COLORS: Record<PickupState['kind'], number> = {
  normal: 0xffffff,
  explosive: 0xe67e22,
  piercing: 0x9b59b6,
  smoke: 0x95a5a6,
  repair: 0x2ecc71,
};
const PICKUP_LETTER: Record<PickupState['kind'], string> = { normal: '', explosive: 'E', piercing: 'P', smoke: 'S', repair: '+' };
const SMOKE_ALPHA = 0.85;

/** Plays a sound unless the player muted the game. */
export function playSfx(scene: Phaser.Scene, key: string): void {
  if (!useStore.getState().muted) scene.sound.play(key, { volume: SFX_VOLUME });
}

/** Bullets, pickups, smoke clouds and explosions, kept in sync with each rendered snapshot. */
export class WorldView {
  private readonly bullets = new Map<string, Phaser.GameObjects.Image>();
  private readonly pickups = new Map<string, { dot: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text }>();
  private readonly smokes = new Map<string, Phaser.GameObjects.Image>();

  constructor(private readonly scene: Phaser.Scene) {}

  update(snap: GameSnapshot): void {
    this.syncBullets(snap);
    this.syncPickups(snap);
    this.syncSmokes(snap);
  }

  /** Animated blast of the given radius (Kenney smoke frames), centred on (x, y). */
  explode(x: number, y: number, r: number): void {
    const sprite = this.scene.add.image(x, y, TEXTURE.explosion(0)).setDepth(5);
    sprite.setScale((r * 2) / EXPLOSION_SPRITE_PX);
    let frame = 0;
    this.scene.time.addEvent({
      delay: EXPLOSION_FRAME_MS,
      repeat: EXPLOSION_FRAMES - 1,
      callback: () => {
        frame += 1;
        if (frame >= EXPLOSION_FRAMES) sprite.destroy();
        else sprite.setTexture(TEXTURE.explosion(frame));
      },
    });
  }

  private syncBullets(snap: GameSnapshot): void {
    const seen = new Set<string>();
    for (const b of snap.bullets) {
      seen.add(b.id);
      let v = this.bullets.get(b.id);
      if (!v) {
        v = this.scene.add.image(b.x, b.y, TEXTURE.bullet(b.kind)).setScale(BULLET_SPRITE_SCALE);
        this.bullets.set(b.id, v);
        playSfx(this.scene, SOUND.fire);
      } else if (Math.hypot(b.x - v.x, b.y - v.y) > 0.1) {
        v.setRotation(Math.atan2(b.y - v.y, b.x - v.x) + SPRITE_FACING_OFFSET);
      }
      v.setPosition(b.x, b.y);
    }
    this.prune(this.bullets, seen);
  }

  private syncPickups(snap: GameSnapshot): void {
    for (const p of snap.pickups) {
      let view = this.pickups.get(p.id);
      if (!view) {
        const dot = this.scene.add.circle(p.x, p.y, PICKUP_RADIUS, PICKUP_COLORS[p.kind]).setStrokeStyle(2, 0xffffff).setDepth(-0.5);
        const label = this.scene.add
          .text(p.x, p.y, PICKUP_LETTER[p.kind], { fontSize: '14px', color: '#000', fontStyle: 'bold' })
          .setOrigin(0.5)
          .setDepth(-0.4);
        view = { dot, label };
        this.pickups.set(p.id, view);
      }
      view.dot.setVisible(p.active);
      view.label.setVisible(p.active);
    }
  }

  private syncSmokes(snap: GameSnapshot): void {
    const seen = new Set<string>();
    for (const s of snap.smokes) {
      seen.add(s.id);
      if (!this.smokes.has(s.id)) {
        const cloud = this.scene.add.image(s.x, s.y, TEXTURE.smoke).setDepth(4).setAlpha(SMOKE_ALPHA);
        cloud.setScale((s.r * 2) / EXPLOSION_SPRITE_PX);
        this.smokes.set(s.id, cloud);
      }
    }
    this.prune(this.smokes, seen);
  }

  private prune(views: Map<string, Phaser.GameObjects.Image>, seen: Set<string>): void {
    for (const [id, v] of views) {
      if (seen.has(id)) continue;
      v.destroy();
      views.delete(id);
    }
  }
}

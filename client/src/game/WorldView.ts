import Phaser from 'phaser';
import { BULLET_RADIUS, PICKUP_RADIUS } from '@crew-tanks/shared/constants';
import type { AmmoKind, GameSnapshot, PickupState } from '@crew-tanks/shared/types';

const BULLET_COLORS: Record<AmmoKind, number> = {
  normal: 0xf1c40f,
  piercing: 0x9b59b6,
  explosive: 0xe67e22,
  smoke: 0xbdc3c7,
};
const PICKUP_COLORS: Record<PickupState['kind'], number> = {
  normal: 0xffffff,
  explosive: 0xe67e22,
  piercing: 0x9b59b6,
  smoke: 0x95a5a6,
  repair: 0x2ecc71,
};
const PICKUP_LETTER: Record<PickupState['kind'], string> = { normal: '', explosive: 'E', piercing: 'P', smoke: 'S', repair: '+' };
const EXPLOSION_MS = 350;
const SMOKE_COLOR = 0xcfd8dc;

/** Bullets, pickups, smoke clouds and explosion flashes, kept in sync with each rendered snapshot. */
export class WorldView {
  private readonly bullets = new Map<string, Phaser.GameObjects.Arc>();
  private readonly pickups = new Map<string, { dot: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text }>();
  private readonly smokes = new Map<string, Phaser.GameObjects.Arc>();

  constructor(private readonly scene: Phaser.Scene) {}

  update(snap: GameSnapshot): void {
    this.syncBullets(snap);
    this.syncPickups(snap);
    this.syncSmokes(snap);
  }

  /** Expanding ring where a shell went off. */
  explode(x: number, y: number, r: number): void {
    const ring = this.scene.add.circle(x, y, r * 0.2, 0xff9f43, 0.6).setDepth(5);
    this.scene.tweens.add({ targets: ring, radius: r, alpha: 0, duration: EXPLOSION_MS, onComplete: () => ring.destroy() });
  }

  private syncBullets(snap: GameSnapshot): void {
    const seen = new Set<string>();
    for (const b of snap.bullets) {
      seen.add(b.id);
      const v = this.bullets.get(b.id) ?? this.scene.add.circle(b.x, b.y, BULLET_RADIUS, BULLET_COLORS[b.kind]);
      v.setPosition(b.x, b.y);
      this.bullets.set(b.id, v);
    }
    this.prune(this.bullets, seen);
  }

  private syncPickups(snap: GameSnapshot): void {
    const seen = new Set<string>();
    for (const p of snap.pickups) {
      seen.add(p.id);
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
      const v = this.smokes.get(s.id) ?? this.scene.add.circle(s.x, s.y, s.r, SMOKE_COLOR, 0.55).setDepth(4);
      this.smokes.set(s.id, v);
    }
    this.prune(this.smokes, seen);
  }

  private prune(views: Map<string, Phaser.GameObjects.Arc>, seen: Set<string>): void {
    for (const [id, v] of views) {
      if (seen.has(id)) continue;
      v.destroy();
      views.delete(id);
    }
  }
}

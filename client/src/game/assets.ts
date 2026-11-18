import type Phaser from 'phaser';
import type { AmmoKind, TeamId } from '@crew-tanks/shared/types';
import { EXPLOSION_FRAMES } from '@crew-tanks/shared/constants';

const TANKS = '/assets/kenney/tanks/';
const AUDIO = '/assets/kenney/audio/';

export const TEXTURE = {
  tank: (team: TeamId): string => `tank-${team}`,
  barrel: (team: TeamId): string => `barrel-${team}`,
  bullet: (kind: AmmoKind): string => `bullet-${kind}`,
  explosion: (frame: number): string => `explosion-${frame}`,
  smoke: 'smoke-cloud',
  grass: 'grass',
} as const;

export const SOUND = { fire: 'sfx-fire', explosion: 'sfx-explosion', pickup: 'sfx-pickup', kill: 'sfx-kill' } as const;

const BULLET_FILES: Record<AmmoKind, string> = {
  normal: 'bulletYellow',
  piercing: 'bulletBlue',
  explosive: 'bulletRed',
  smoke: 'bulletSilver',
};

/** Queue every sprite and sound the battle uses (Kenney CC0, see client/public/assets/README.md). */
export function preloadAssets(load: Phaser.Loader.LoaderPlugin): void {
  for (const team of ['red', 'blue'] as const) {
    const name = team === 'red' ? 'Red' : 'Blue';
    load.image(TEXTURE.tank(team), `${TANKS}tank${name}.png`);
    load.image(TEXTURE.barrel(team), `${TANKS}barrel${name}.png`);
  }
  for (const kind of Object.keys(BULLET_FILES) as AmmoKind[]) load.image(TEXTURE.bullet(kind), `${TANKS}${BULLET_FILES[kind]}.png`);
  for (let i = 0; i < EXPLOSION_FRAMES; i++) load.image(TEXTURE.explosion(i), `${TANKS}smokeOrange${i}.png`);
  load.image(TEXTURE.smoke, `${TANKS}smokeGrey0.png`);
  load.image(TEXTURE.grass, `${TANKS}grass.png`);
  load.audio(SOUND.fire, `${AUDIO}laserSmall_000.ogg`);
  load.audio(SOUND.explosion, `${AUDIO}explosionCrunch_000.ogg`);
  load.audio(SOUND.pickup, `${AUDIO}forceField_000.ogg`);
  load.audio(SOUND.kill, `${AUDIO}lowFrequency_explosion_000.ogg`);
}

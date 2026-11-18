import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { WORLD_HEIGHT, WORLD_WIDTH } from '@crew-tanks/shared/constants';
import { BattleScene } from './BattleScene';

/** Mounts one Phaser game; destroys it (and its canvas) on unmount. */
export function GameCanvas() {
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
      backgroundColor: '#3a5f3a',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [new BattleScene()],
    });
    return () => {
      game.destroy(true);
    };
  }, []);

  return <div ref={parentRef} style={{ width: '100vw', height: '100vh' }} />;
}

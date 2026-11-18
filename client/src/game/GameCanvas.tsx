import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { WORLD_HEIGHT, WORLD_WIDTH } from '@crew-tanks/shared/constants';
import { BattleScene } from './BattleScene';
import type { GameSocket } from '../net/socket';

/** Mounts one Phaser game; destroys it (and its canvas) on unmount. */
export function GameCanvas({ socket }: { socket: GameSocket }) {
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
      scene: [new BattleScene(socket)],
    });
    return () => {
      game.destroy(true);
    };
  }, [socket]);

  return <div ref={parentRef} style={{ width: '100vw', height: '100vh' }} />;
}

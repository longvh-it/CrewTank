import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { WORLD_HEIGHT, WORLD_WIDTH } from '@crew-tanks/shared/constants';
import { BattleScene } from './BattleScene';
import { getMap } from './maps';
import type { GameSocket } from '../net/socket';
import type { CrewRole } from './inputRole';

/** Mounts one Phaser game; destroys it (and its canvas) on unmount. */
export function GameCanvas({ socket, mapId, ownTankId, role }: { socket: GameSocket; mapId: string; ownTankId: string | null; role: CrewRole }) {
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
      scene: [new BattleScene(socket, getMap(mapId), ownTankId, role)],
    });
    return () => {
      game.destroy(true);
    };
  }, [socket, mapId, ownTankId, role]);

  return <div ref={parentRef} style={{ width: '100vw', height: '100vh' }} />;
}

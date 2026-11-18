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
  const sceneRef = useRef<BattleScene | null>(null);
  const roleRef = useRef(role);
  roleRef.current = role;

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;
    const scene = new BattleScene(socket, getMap(mapId), ownTankId, roleRef.current);
    sceneRef.current = scene;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
      backgroundColor: '#3a5f3a',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [scene],
    });
    return () => {
      sceneRef.current = null;
      game.destroy(true);
    };
  }, [socket, mapId, ownTankId]);

  // Roles change mid-match when the crew swaps seats: update the running scene, do not restart it.
  useEffect(() => {
    sceneRef.current?.setRole(role);
  }, [role]);

  return <div ref={parentRef} style={{ width: '100vw', height: '100vh' }} />;
}

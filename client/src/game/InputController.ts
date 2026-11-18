import Phaser from 'phaser';
import type { PlayerInput } from '@crew-tanks/shared/types';

type Axis = -1 | 0 | 1;

function axis(negative: boolean, positive: boolean): Axis {
  if (negative === positive) return 0;
  return positive ? 1 : -1;
}

/** Turns keyboard + mouse state into a `PlayerInput`. Aim angle is in world space, radians. */
export class InputController {
  private seq = 0;
  private readonly keys: Record<'W' | 'A' | 'S' | 'D' | 'SHIFT' | 'R' | 'F', Phaser.Input.Keyboard.Key>;

  constructor(private readonly scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input plugin missing');
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      W: keyboard.addKey(K.W),
      A: keyboard.addKey(K.A),
      S: keyboard.addKey(K.S),
      D: keyboard.addKey(K.D),
      SHIFT: keyboard.addKey(K.SHIFT),
      R: keyboard.addKey(K.R),
      F: keyboard.addKey(K.F),
    };
    scene.input.mouse?.disableContextMenu();
  }

  /** `origin` = turret position in world coordinates. */
  read(origin: { x: number; y: number }): PlayerInput {
    const k = this.keys;
    const pointer = this.scene.input.activePointer;
    pointer.updateWorldPoint(this.scene.cameras.main);
    return {
      seq: ++this.seq,
      move: {
        throttle: axis(k.S.isDown, k.W.isDown),
        turn: axis(k.A.isDown, k.D.isDown),
        boost: k.SHIFT.isDown,
        repair: k.R.isDown,
      },
      aim: {
        angle: Math.atan2(pointer.worldY - origin.y, pointer.worldX - origin.x),
        fire: pointer.leftButtonDown(),
        special: pointer.rightButtonDown(),
      },
      swap: k.F.isDown,
    };
  }
}

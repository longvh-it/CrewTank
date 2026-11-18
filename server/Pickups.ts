import { PICKUP_RADIUS, PICKUP_RESPAWN_SEC, TANK_RADIUS } from '@crew-tanks/shared/constants';
import type { PickupKind, PickupSpawn } from '@crew-tanks/shared/map';
import { applyPickup, canCollectPickup } from '@crew-tanks/shared/specials';
import type { GameEvent, PickupState, TankState } from '@crew-tanks/shared/types';

interface Pickup extends PickupState {
  kind: PickupKind;
  respawnAt: number;
}

/** Fixed pickup points: a tank driving over an active one collects it; it returns after PICKUP_RESPAWN_SEC. */
export class Pickups {
  private readonly items: Pickup[];

  constructor(spawns: readonly PickupSpawn[]) {
    this.items = spawns.map((s, i) => ({ id: `p${i}`, x: s.x, y: s.y, kind: s.kind, active: true, respawnAt: 0 }));
  }

  step(tanks: Iterable<TankState>, now: number, emit: (e: GameEvent) => void): void {
    for (const item of this.items) {
      if (!item.active && now >= item.respawnAt) item.active = true;
      if (!item.active) continue;
      for (const tank of tanks) {
        if (!canCollectPickup(tank, item.kind)) continue;
        if (Math.hypot(tank.x - item.x, tank.y - item.y) > TANK_RADIUS + PICKUP_RADIUS) continue;
        const next = applyPickup(tank, item.kind);
        tank.hp = next.hp;
        tank.specialAmmo = next.specialAmmo;
        tank.specialKind = next.specialKind;
        item.active = false;
        item.respawnAt = now + PICKUP_RESPAWN_SEC * 1000;
        emit({ type: 'pickup', tankId: tank.id, kind: item.kind });
        break;
      }
    }
  }

  states(): PickupState[] {
    return this.items.map(({ respawnAt: _respawnAt, ...state }) => state);
  }
}

import {
  AMMO_PER_PICKUP,
  BOOST_COOLDOWN_SEC,
  BOOST_DURATION_SEC,
  BULLET_DAMAGE,
  BULLET_MAX_BOUNCES,
  EXPLOSIVE_DAMAGE,
  PIERCING_DAMAGE,
  PIERCING_MAX_BOUNCES,
  REPAIR_HP_PER_SEC,
  REPAIR_KIT_HP,
  SEAT_SWAP_HOLD_SEC,
  TANK_STATS,
} from './constants';
import type { PickupKind } from './map';
import type { AmmoKind, SmokeZone, TankState } from './types';

export interface Point2 {
  x: number;
  y: number;
}

export interface AmmoProfile {
  damage: number;
  maxBounces: number;
  /** Shells that go off on impact / when they expire instead of dealing direct damage. */
  detonates: boolean;
}

export const AMMO_PROFILE: Record<AmmoKind, AmmoProfile> = {
  normal: { damage: BULLET_DAMAGE, maxBounces: BULLET_MAX_BOUNCES, detonates: false },
  piercing: { damage: PIERCING_DAMAGE, maxBounces: PIERCING_MAX_BOUNCES, detonates: false },
  explosive: { damage: EXPLOSIVE_DAMAGE, maxBounces: 0, detonates: true },
  smoke: { damage: 0, maxBounces: 0, detonates: true },
};

type Collector = Pick<TankState, 'crew' | 'hp' | 'maxHp' | 'specialAmmo' | 'specialKind' | 'alive'>;

/** Repair kits help any damaged tank; special shells only fit 2-crew tanks that are not already full of that kind. */
export function canCollectPickup(tank: Collector, kind: PickupKind): boolean {
  if (!tank.alive) return false;
  if (kind === 'repair') return tank.hp < tank.maxHp;
  const max = TANK_STATS[tank.crew].maxSpecialAmmo;
  if (max === 0) return false;
  return !(tank.specialKind === kind && tank.specialAmmo >= max);
}

/** New HP / ammo after collecting. Collecting another kind replaces the current shells. */
export function applyPickup(
  tank: Collector,
  kind: PickupKind,
): { hp: number; specialAmmo: number; specialKind: AmmoKind | null } {
  if (kind === 'repair') {
    return { hp: Math.min(tank.maxHp, tank.hp + REPAIR_KIT_HP), specialAmmo: tank.specialAmmo, specialKind: tank.specialKind };
  }
  const max = TANK_STATS[tank.crew].maxSpecialAmmo;
  const base = tank.specialKind === kind ? tank.specialAmmo : 0;
  return { hp: tank.hp, specialAmmo: Math.min(max, base + AMMO_PER_PICKUP), specialKind: kind };
}

/** Use one special shell: returns the kind fired (or 'normal' without ammo) and the remaining ammo state. */
export function takeShell(tank: Pick<TankState, 'specialAmmo' | 'specialKind'>, wantsSpecial: boolean): {
  kind: AmmoKind;
  specialAmmo: number;
  specialKind: AmmoKind | null;
} {
  if (wantsSpecial && tank.specialKind && tank.specialAmmo > 0) {
    const left = tank.specialAmmo - 1;
    return { kind: tank.specialKind, specialAmmo: left, specialKind: left > 0 ? tank.specialKind : null };
  }
  return { kind: 'normal', specialAmmo: tank.specialAmmo, specialKind: tank.specialKind };
}

export interface BoostState {
  boostUntil: number;
  readyAt: number;
}

/**
 * Boost (2-crew tanks only): pressing Shift while ready starts BOOST_DURATION_SEC of speed;
 * the cooldown runs from activation.
 */
export function updateBoost(state: BoostState, wants: boolean, canBoost: boolean, now: number): BoostState {
  if (wants && canBoost && now >= state.readyAt && now >= state.boostUntil) {
    return { boostUntil: now + BOOST_DURATION_SEC * 1000, readyAt: now + BOOST_COOLDOWN_SEC * 1000 };
  }
  return state;
}

export const isBoosting = (state: BoostState, now: number): boolean => now < state.boostUntil;

/** HP after `dt` seconds of holding R; only works while standing still. */
export function repairHp(hp: number, maxHp: number, dt: number, holdingRepair: boolean, moving: boolean): number {
  if (!holdingRepair || moving) return hp;
  return Math.min(maxHp, hp + REPAIR_HP_PER_SEC * dt);
}

export interface SwapHold {
  heldSec: number;
  /** After a swap, both must let go before the next one can start. */
  latched: boolean;
}

/** Both crew must hold F together for SEAT_SWAP_HOLD_SEC. */
export function stepSwapHold(state: SwapHold, driverHeld: boolean, gunnerHeld: boolean, dt: number): { state: SwapHold; triggered: boolean } {
  if (!driverHeld || !gunnerHeld) return { state: { heldSec: 0, latched: false }, triggered: false };
  if (state.latched) return { state, triggered: false };
  const heldSec = state.heldSec + dt;
  if (heldSec >= SEAT_SWAP_HOLD_SEC) return { state: { heldSec: 0, latched: true }, triggered: true };
  return { state: { heldSec, latched: false }, triggered: false };
}

/** Ids of live tanks (not on `ownTeam` unless `friendlyFire`) whose centre is within `radius`. */
export function tanksInBlast(
  centre: Point2,
  radius: number,
  tanks: Iterable<Pick<TankState, 'id' | 'team' | 'x' | 'y' | 'alive'>>,
  ownTeam: TankState['team'],
  friendlyFire: boolean,
): string[] {
  const out: string[] = [];
  for (const t of tanks) {
    if (!t.alive || (!friendlyFire && t.team === ownTeam)) continue;
    if (Math.hypot(t.x - centre.x, t.y - centre.y) <= radius) out.push(t.id);
  }
  return out;
}

export function isInSmoke(p: Point2, smokes: readonly Pick<SmokeZone, 'x' | 'y' | 'r'>[]): boolean {
  return smokes.some((s) => Math.hypot(p.x - s.x, p.y - s.y) <= s.r);
}

/** Smoke hides a tank from the enemy team only; its own team still sees it. */
export function hiddenBySmoke(viewerTeam: TankState['team'] | null, tank: Pick<TankState, 'team' | 'x' | 'y'>, smokes: readonly Pick<SmokeZone, 'x' | 'y' | 'r'>[]): boolean {
  return viewerTeam !== null && tank.team !== viewerTeam && isInSmoke(tank, smokes);
}

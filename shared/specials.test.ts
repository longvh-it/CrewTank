import { describe, expect, it } from 'vitest';
import {
  AMMO_PROFILE, applyPickup, canCollectPickup, hiddenBySmoke, isBoosting, isInSmoke, repairHp, stepSwapHold,
  takeShell, tanksInBlast, updateBoost,
} from './specials';
import {
  AMMO_PER_PICKUP, BOOST_COOLDOWN_SEC, BOOST_DURATION_SEC, EXPLOSIVE_DAMAGE, EXPLOSIVE_RADIUS, PIERCING_DAMAGE,
  REPAIR_HP_PER_SEC, REPAIR_KIT_HP, SEAT_SWAP_HOLD_SEC, TANK_STATS,
} from './constants';

const tank = (over: Partial<Parameters<typeof canCollectPickup>[0]> = {}) => ({
  crew: 2 as const, hp: 100, maxHp: 130, specialAmmo: 0, specialKind: null, alive: true, ...over,
});

describe('ammo profiles', () => {
  it('match DESIGN: piercing 40 dmg no bounce, explosive 30, smoke no damage', () => {
    expect(AMMO_PROFILE.piercing).toMatchObject({ damage: PIERCING_DAMAGE, maxBounces: 0 });
    expect(AMMO_PROFILE.explosive).toMatchObject({ damage: EXPLOSIVE_DAMAGE, detonates: true });
    expect(AMMO_PROFILE.smoke).toMatchObject({ damage: 0, detonates: true });
    expect(AMMO_PROFILE.normal.maxBounces).toBe(2);
  });
});

describe('pickups', () => {
  it('only 2-crew tanks can hold special shells', () => {
    expect(canCollectPickup(tank({ crew: 1 }), 'explosive')).toBe(false);
    expect(canCollectPickup(tank(), 'explosive')).toBe(true);
  });
  it('repair kits work for any damaged tank and are not wasted on a full one', () => {
    expect(canCollectPickup(tank({ crew: 1 }), 'repair')).toBe(true);
    expect(canCollectPickup(tank({ hp: 130 }), 'repair')).toBe(false);
  });
  it('dead tanks collect nothing', () => expect(canCollectPickup(tank({ alive: false }), 'repair')).toBe(false));
  it('repair heals REPAIR_KIT_HP, capped at max HP', () => {
    expect(applyPickup(tank({ hp: 50 }), 'repair').hp).toBe(50 + REPAIR_KIT_HP);
    expect(applyPickup(tank({ hp: 120 }), 'repair').hp).toBe(130);
  });
  it('ammo stacks for the same kind up to the cap and is replaced by another kind', () => {
    const max = TANK_STATS[2].maxSpecialAmmo;
    const first = applyPickup(tank(), 'smoke');
    expect(first).toMatchObject({ specialKind: 'smoke', specialAmmo: Math.min(max, AMMO_PER_PICKUP) });
    expect(applyPickup(tank({ specialKind: 'smoke', specialAmmo: 1 }), 'smoke').specialAmmo).toBe(Math.min(max, 1 + AMMO_PER_PICKUP));
    expect(applyPickup(tank({ specialKind: 'smoke', specialAmmo: 2 }), 'explosive')).toMatchObject({ specialKind: 'explosive', specialAmmo: Math.min(max, AMMO_PER_PICKUP) });
    expect(canCollectPickup(tank({ specialKind: 'smoke', specialAmmo: max }), 'smoke')).toBe(false);
    expect(canCollectPickup(tank({ specialKind: 'smoke', specialAmmo: max }), 'explosive')).toBe(true);
  });
});

describe('takeShell', () => {
  it('uses a special shell on right click and clears the kind at zero', () => {
    expect(takeShell({ specialKind: 'explosive', specialAmmo: 2 }, true)).toEqual({ kind: 'explosive', specialAmmo: 1, specialKind: 'explosive' });
    expect(takeShell({ specialKind: 'explosive', specialAmmo: 1 }, true)).toEqual({ kind: 'explosive', specialAmmo: 0, specialKind: null });
  });
  it('fires a normal shell without ammo or without right click', () => {
    expect(takeShell({ specialKind: null, specialAmmo: 0 }, true).kind).toBe('normal');
    expect(takeShell({ specialKind: 'smoke', specialAmmo: 3 }, false)).toEqual({ kind: 'normal', specialAmmo: 3, specialKind: 'smoke' });
  });
});

describe('boost', () => {
  const idle = { boostUntil: 0, readyAt: 0 };
  it('starts when wanted, ready and allowed', () => {
    const s = updateBoost(idle, true, true, 1000);
    expect(s).toEqual({ boostUntil: 1000 + BOOST_DURATION_SEC * 1000, readyAt: 1000 + BOOST_COOLDOWN_SEC * 1000 });
    expect(isBoosting(s, 1000 + BOOST_DURATION_SEC * 1000 - 1)).toBe(true);
    expect(isBoosting(s, 1000 + BOOST_DURATION_SEC * 1000)).toBe(false);
  });
  it('solo tanks cannot boost, and nothing happens without the key', () => {
    expect(updateBoost(idle, true, false, 1000)).toBe(idle);
    expect(updateBoost(idle, false, true, 1000)).toBe(idle);
  });
  it('respects the cooldown and does not restart while boosting', () => {
    const s = updateBoost(idle, true, true, 0);
    expect(updateBoost(s, true, true, 500)).toBe(s);
    expect(updateBoost(s, true, true, BOOST_COOLDOWN_SEC * 1000 - 1)).toBe(s);
    expect(updateBoost(s, true, true, BOOST_COOLDOWN_SEC * 1000).readyAt).toBe(2 * BOOST_COOLDOWN_SEC * 1000);
  });
});

describe('repairHp', () => {
  it('heals REPAIR_HP_PER_SEC while holding R and standing still, capped at max', () => {
    expect(repairHp(50, 100, 1, true, false)).toBe(50 + REPAIR_HP_PER_SEC);
    expect(repairHp(95, 100, 1, true, false)).toBe(100);
  });
  it('does nothing while moving or without R', () => {
    expect(repairHp(50, 100, 1, true, true)).toBe(50);
    expect(repairHp(50, 100, 1, false, false)).toBe(50);
  });
});

describe('stepSwapHold', () => {
  const fresh = { heldSec: 0, latched: false };
  it('triggers once both held F for SEAT_SWAP_HOLD_SEC', () => {
    let s = fresh;
    let fired = false;
    for (let t = 0; t < SEAT_SWAP_HOLD_SEC + 0.1 && !fired; t += 0.1) {
      const r = stepSwapHold(s, true, true, 0.1);
      s = r.state;
      fired = r.triggered;
    }
    expect(fired).toBe(true);
  });
  it('one holder is not enough, and releasing resets progress', () => {
    let r = stepSwapHold(fresh, true, false, 10);
    expect(r.triggered).toBe(false);
    r = stepSwapHold({ heldSec: 0.4, latched: false }, true, false, 0.1);
    expect(r.state.heldSec).toBe(0);
  });
  it('latches after a swap until both release', () => {
    const r1 = stepSwapHold({ heldSec: SEAT_SWAP_HOLD_SEC - 0.01, latched: false }, true, true, 0.1);
    expect(r1.triggered).toBe(true);
    expect(stepSwapHold(r1.state, true, true, 5).triggered).toBe(false);
    const released = stepSwapHold(r1.state, false, false, 0.1);
    expect(released.state).toEqual(fresh);
    expect(stepSwapHold(released.state, true, true, SEAT_SWAP_HOLD_SEC).triggered).toBe(true);
  });
});

describe('tanksInBlast / smoke', () => {
  const t = (id: string, team: 'red' | 'blue', x: number, alive = true) => ({ id, team, x, y: 0, alive });
  it('hits live enemy tanks in range, not friends, not dead ones', () => {
    const tanks = [t('a', 'blue', EXPLOSIVE_RADIUS), t('b', 'blue', EXPLOSIVE_RADIUS + 1), t('c', 'red', 10), t('d', 'blue', 10, false)];
    expect(tanksInBlast({ x: 0, y: 0 }, EXPLOSIVE_RADIUS, tanks, 'red', false)).toEqual(['a']);
    expect(tanksInBlast({ x: 0, y: 0 }, EXPLOSIVE_RADIUS, tanks, 'red', true)).toEqual(['a', 'c']);
  });
  it('smoke hides enemy tanks inside only', () => {
    const smokes = [{ x: 100, y: 100, r: 50 }];
    expect(isInSmoke({ x: 120, y: 100 }, smokes)).toBe(true);
    expect(isInSmoke({ x: 200, y: 100 }, smokes)).toBe(false);
    expect(hiddenBySmoke('red', { team: 'blue', x: 110, y: 100 }, smokes)).toBe(true);
    expect(hiddenBySmoke('red', { team: 'red', x: 110, y: 100 }, smokes)).toBe(false);
    expect(hiddenBySmoke('red', { team: 'blue', x: 500, y: 100 }, smokes)).toBe(false);
    expect(hiddenBySmoke(null, { team: 'blue', x: 110, y: 100 }, smokes)).toBe(false);
  });
});

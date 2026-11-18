import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseTiledMap } from '@crew-tanks/shared/map';
import { RESPAWN_DELAY_SEC, SPAWN_INVULNERABLE_SEC, TANK_STATS, TICK_HZ } from '@crew-tanks/shared/constants';
import type { GameEvent, PlayerInput } from '@crew-tanks/shared/types';
import { Game } from './Game';

const map = parseTiledMap(JSON.parse(readFileSync(new URL('./maps/arena-01.json', import.meta.url), 'utf8')));
const DT = 1 / TICK_HZ;

function setup() {
  const events: GameEvent[] = [];
  const game = new Game({ state: vi.fn(), event: (e: GameEvent) => events.push(e) }, map);
  return { game, events };
}
const aimFire = (angle: number, fire: boolean): PlayerInput => ({ seq: 1, aim: { angle, fire, special: false }, swap: false });
const tankOf = (g: Game, id: string) => {
  const t = g.snapshot().tanks.find((x) => x.id === id);
  if (!t) throw new Error('no tank');
  return t;
};

/** red 'a' spawns at (112,272), blue 'b' at (1168,272): same row, open line of fire blocked by cover; move b next to a. */
function duel() {
  const { game, events } = setup();
  game.addTank({ id: 'a', team: 'red', crew: 1 });
  game.addTank({ id: 'b', team: 'blue', crew: 1 });
  game.teleport('a', 300, 100);
  game.teleport('b', 500, 100);
  return { game, events };
}

describe('Game shooting', () => {
  it('a hit costs BULLET_DAMAGE hp and emits hit', () => {
    const { game, events } = duel();
    game.setInput('a', 'driver', aimFire(0, true));
    let now = 1000;
    for (let i = 0; i < 40 && !events.length; i++) game.tick(DT, (now += 33));
    expect(events[0]).toMatchObject({ type: 'hit', tankId: 'b', dmg: 20 });
    expect(tankOf(game, 'b').hp).toBe(TANK_STATS[1].maxHp - 20);
  });

  it('kills after enough hits, emits kill, respawns after delay with invulnerability', () => {
    const { game, events } = duel();
    game.setInput('a', 'driver', aimFire(0, true));
    let now = 1000;
    while (!events.some((e) => e.type === 'kill') && now < 60_000) game.tick(DT, (now += 33));
    expect(events.find((e) => e.type === 'kill')).toEqual({ type: 'kill', killerTankId: 'a', victimTankId: 'b' });
    const dead = tankOf(game, 'b');
    expect(dead.alive).toBe(false);
    const diedAt = dead.respawnAt;
    expect(diedAt).not.toBeNull();
    game.setInput('a', 'driver', aimFire(0, false));
    game.tick(DT, (diedAt ?? 0) - 1);
    expect(tankOf(game, 'b').alive).toBe(false);
    game.tick(DT, diedAt ?? 0);
    const back = tankOf(game, 'b');
    expect(back.alive).toBe(true);
    expect(back.hp).toBe(back.maxHp);
    expect(back.invulnerableUntil).toBe((diedAt ?? 0) + SPAWN_INVULNERABLE_SEC * 1000);
    expect(back.x).toBeGreaterThan(1000); // blue spawn side
    expect((diedAt ?? 0) - now).toBeLessThanOrEqual(RESPAWN_DELAY_SEC * 1000);
  });

  it('invulnerable tanks take no damage', () => {
    const { game, events } = duel();
    game.setInput('a', 'driver', aimFire(0, true));
    game.setInvulnerable('b', 1e12);
    let now = 1000;
    for (let i = 0; i < 60; i++) game.tick(DT, (now += 33));
    expect(events.length).toBe(0);
    expect(tankOf(game, 'b').hp).toBe(TANK_STATS[1].maxHp);
  });

  it('no friendly fire: a teammate in the line of fire is not damaged', () => {
    const { game, events } = setup();
    game.addTank({ id: 'a', team: 'red', crew: 1 });
    game.addTank({ id: 'b', team: 'blue', crew: 1 });
    game.addTank({ id: 'c', team: 'red', crew: 1 });
    game.teleport('a', 300, 100);
    game.teleport('c', 400, 100);
    game.teleport('b', 100, 600);
    game.setInput('a', 'driver', aimFire(0, true));
    let now = 1000;
    for (let i = 0; i < 60; i++) game.tick(DT, (now += 33));
    expect(events.length).toBe(0);
    expect(tankOf(game, 'c').hp).toBe(TANK_STATS[1].maxHp);
  });

  it('respects reload time', () => {
    const { game } = duel();
    game.setInput('a', 'driver', aimFire(Math.PI / 2, true)); // fire into the south cover, away from b
    let now = 1000;
    for (let i = 0; i < 10; i++) game.tick(DT, (now += 33)); // ~0.33 s < 0.8 s reload
    expect(game.snapshot().bullets.length).toBe(1);
  });

  it('bullets expire after their lifetime', () => {
    const { game } = duel();
    game.setInput('a', 'driver', aimFire(-Math.PI / 2, true));
    game.tick(DT, 1000);
    game.setInput('a', 'driver', aimFire(-Math.PI / 2, false));
    expect(game.snapshot().bullets.length).toBe(1);
    game.tick(DT, 1000 + 3001);
    expect(game.snapshot().bullets.length).toBe(0);
  });
});

describe('Game crews', () => {
  it('2-crew tanks use 2-crew stats and hpBonus scales max HP', () => {
    const { game } = setup();
    game.addTank({ id: 'duo', team: 'red', crew: 2 });
    game.addTank({ id: 'solo', team: 'blue', crew: 1, hpBonus: 0.2 });
    expect(tankOf(game, 'duo')).toMatchObject({ crew: 2, maxHp: TANK_STATS[2].maxHp });
    expect(tankOf(game, 'solo')).toMatchObject({ crew: 1, maxHp: Math.round(TANK_STATS[1].maxHp * 1.2) });
  });

  it('in a 2-crew tank only the driver moves and only the gunner aims', () => {
    const { game } = setup();
    game.addTank({ id: 'duo', team: 'red', crew: 2 });
    const start = tankOf(game, 'duo');
    const full: PlayerInput = {
      seq: 1,
      move: { throttle: 1, turn: 0, boost: false, repair: false },
      aim: { angle: Math.PI / 2, fire: false, special: false },
      swap: false,
    };
    game.setInput('duo', 'gunner', full); // gunner's move must be ignored
    game.tick(DT, 1000);
    expect(tankOf(game, 'duo').x).toBe(start.x);
    expect(tankOf(game, 'duo').turretAngle).not.toBe(start.turretAngle);
    const turretBefore = tankOf(game, 'duo').turretAngle;
    // driver's aim (pointing the other way) must be ignored: the turret keeps following the gunner's aim
    game.setInput('duo', 'driver', { ...full, aim: { angle: -Math.PI / 2, fire: false, special: false } });
    game.tick(DT, 1033);
    expect(tankOf(game, 'duo').x).toBeGreaterThan(start.x);
    expect(tankOf(game, 'duo').turretAngle).toBeGreaterThan(turretBefore);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseTiledMap } from '@crew-tanks/shared/map';
import { RESPAWN_DELAY_SEC, SPAWN_INVULNERABLE_SEC, TANK_STATS, TICK_HZ } from '@crew-tanks/shared/constants';
import type { GameEvent, MatchResult, PlayerInput } from '@crew-tanks/shared/types';
import { Game } from './Game';

const map = parseTiledMap(JSON.parse(readFileSync(new URL('./maps/arena-01.json', import.meta.url), 'utf8')));
const DT = 1 / TICK_HZ;

function setup(options?: { killLimit: number; timeLimitSec: number }) {
  const events: GameEvent[] = [];
  const ends: MatchResult[] = [];
  const game = new Game({ state: vi.fn(), event: (e: GameEvent) => events.push(e), end: (r: MatchResult) => ends.push(r) }, map, options);
  return { game, events, ends };
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
  game.addTank({ id: 'a', team: 'red', crew: 1, driverId: null, gunnerId: null });
  game.addTank({ id: 'b', team: 'blue', crew: 1, driverId: null, gunnerId: null });
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
    game.addTank({ id: 'a', team: 'red', crew: 1, driverId: null, gunnerId: null });
    game.addTank({ id: 'b', team: 'blue', crew: 1, driverId: null, gunnerId: null });
    game.addTank({ id: 'c', team: 'red', crew: 1, driverId: null, gunnerId: null });
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
    game.addTank({ id: 'duo', team: 'red', crew: 2, driverId: null, gunnerId: null });
    game.addTank({ id: 'solo', team: 'blue', crew: 1, driverId: null, gunnerId: null, hpBonus: 0.2 });
    expect(tankOf(game, 'duo')).toMatchObject({ crew: 2, maxHp: TANK_STATS[2].maxHp });
    expect(tankOf(game, 'solo')).toMatchObject({ crew: 1, maxHp: Math.round(TANK_STATS[1].maxHp * 1.2) });
  });

  it('in a 2-crew tank only the driver moves and only the gunner aims', () => {
    const { game } = setup();
    game.addTank({ id: 'duo', team: 'red', crew: 2, driverId: null, gunnerId: null });
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

describe('2-crew vs 1-crew stats', () => {
  const driveRight = (): PlayerInput => ({ seq: 1, move: { throttle: 1, turn: 0, boost: false, repair: false }, swap: false });
  const aimDown: PlayerInput = { seq: 1, aim: { angle: -Math.PI / 2, fire: false, special: false }, swap: false };

  it('speed: solo 160 px/s, duo 150 px/s', () => {
    const { game } = setup();
    game.addTank({ id: 'solo', team: 'red', crew: 1, driverId: null, gunnerId: null });
    game.addTank({ id: 'duo', team: 'blue', crew: 2, driverId: null, gunnerId: null });
    game.teleport('solo', 200, 100);
    game.teleport('duo', 300, 100);
    game.setInput('solo', 'driver', driveRight());
    game.setInput('duo', 'driver', driveRight());
    game.tick(0.1, 1000);
    expect(tankOf(game, 'solo').x - 200).toBeCloseTo(TANK_STATS[1].speed * 0.1, 3);
    expect(Math.abs(tankOf(game, 'duo').x - 300)).toBeCloseTo(TANK_STATS[2].speed * 0.1, 3);
  });

  it('turret turn speed: solo 180 deg/s, duo 270 deg/s', () => {
    const { game } = setup();
    game.addTank({ id: 'solo', team: 'red', crew: 1, driverId: null, gunnerId: null });
    game.addTank({ id: 'duo', team: 'blue', crew: 2, driverId: null, gunnerId: null });
    game.setInput('solo', 'driver', aimDown);
    game.setInput('duo', 'gunner', aimDown);
    const a0 = { solo: tankOf(game, 'solo').turretAngle, duo: tankOf(game, 'duo').turretAngle };
    game.tick(0.1, 1000);
    const turned = (id: 'solo' | 'duo') => Math.abs(Math.atan2(Math.sin(tankOf(game, id).turretAngle - a0[id]), Math.cos(tankOf(game, id).turretAngle - a0[id])));
    expect(turned('solo')).toBeCloseTo((TANK_STATS[1].turretTurnSpeed * Math.PI) / 180 * 0.1, 4);
    expect(turned('duo')).toBeCloseTo((TANK_STATS[2].turretTurnSpeed * Math.PI) / 180 * 0.1, 4);
  });

  it('reload: solo 0.8 s, duo 0.6 s', () => {
    const { game } = setup();
    game.addTank({ id: 'solo', team: 'red', crew: 1, driverId: null, gunnerId: null });
    game.addTank({ id: 'duo', team: 'blue', crew: 2, driverId: null, gunnerId: null });
    game.teleport('solo', 200, 100);
    game.teleport('duo', 1000, 600);
    const fireUp = (angle: number): PlayerInput => ({ seq: 1, aim: { angle, fire: true, special: false }, swap: false });
    game.setInput('solo', 'driver', fireUp(-Math.PI / 2));
    game.setInput('duo', 'gunner', fireUp(-Math.PI / 2));
    // at 0.7 s: solo (0.8 s reload) fired once, duo (0.6 s reload) fired twice (t=0 and t=0.6)
    for (let t = 0; t <= 700; t += 10) game.tick(0.01, 1000 + t);
    expect(game.snapshot().bullets.length).toBe(1 + 2);
  });
});

describe('Team Deathmatch', () => {
  const duelWith = (options: { killLimit: number; timeLimitSec: number }) => {
    const r = setup(options);
    r.game.addTank({ id: 'a', team: 'red', crew: 2, driverId: 'ad', gunnerId: 'ag' });
    r.game.addTank({ id: 'b', team: 'blue', crew: 1, driverId: 'bd', gunnerId: null });
    r.game.teleport('a', 300, 100);
    r.game.teleport('b', 500, 100);
    r.game.beginMatch(1000);
    r.game.setInput('a', 'gunner', aimFire(0, true));
    return r;
  };
  const runUntil = (game: Game, done: () => boolean, from = 1000, limit = 120_000) => {
    let now = from;
    while (!done() && now < from + limit) game.tick(DT, (now += 33));
    return now;
  };

  it('a kill scores a point for the killer team and appears in the snapshot', () => {
    const { game, events } = duelWith({ killLimit: 50, timeLimitSec: 600 });
    runUntil(game, () => events.some((e) => e.type === 'kill'));
    expect(game.snapshot().score).toEqual({ red: 1, blue: 0 });
    expect(game.snapshot().endsAt).toBe(1000 + 600_000);
  });

  it('ends when a team reaches the kill limit, with stats and awards', () => {
    const { game, ends } = duelWith({ killLimit: 2, timeLimitSec: 600 });
    // keep the victim standing in the line of fire after each respawn (it respawns at its own base)
    runUntil(game, () => {
      game.teleport('b', 500, 100);
      game.setInvulnerable('b', 0);
      return ends.length > 0;
    });
    expect(ends).toHaveLength(1);
    const r = ends[0]!;
    expect(r.winner).toBe('red');
    expect(r.score.red).toBe(2);
    const stat = (id: string) => r.stats.find((s) => s.playerId === id)!;
    expect(stat('ad').kills).toBe(2); // both crew of the duo get the kills
    expect(stat('ag').kills).toBe(2);
    expect(stat('ag').shots).toBeGreaterThanOrEqual(stat('ag').hits);
    expect(stat('ag').damage).toBeGreaterThan(0);
    expect(stat('bd').deaths).toBe(2);
    expect(r.awards.mvp).toBe('ag');
    expect(r.awards.bestDuo).toEqual(['ad', 'ag']);
  });

  it('no more ticking or events after the match ended', () => {
    const { game, ends } = duelWith({ killLimit: 1, timeLimitSec: 600 });
    const t = runUntil(game, () => ends.length > 0);
    game.tick(DT, t + 100);
    game.tick(DT, t + 200);
    expect(ends).toHaveLength(1);
  });

  it('time limit: higher score wins, equal score is a draw', () => {
    const timed = duelWith({ killLimit: 50, timeLimitSec: 5 });
    timed.game.setInput('a', 'gunner', aimFire(-Math.PI / 2, false)); // nobody shoots anybody
    runUntil(timed.game, () => timed.ends.length > 0, 1000, 10_000);
    expect(timed.ends[0]).toMatchObject({ winner: null, score: { red: 0, blue: 0 } });
  });
});

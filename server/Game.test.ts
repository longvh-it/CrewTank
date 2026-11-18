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
  const swaps: string[] = [];
  const game = new Game({ state: vi.fn(), event: (e: GameEvent) => events.push(e), end: (r: MatchResult) => ends.push(r), swapped: (id: string) => swaps.push(id) }, map, options);
  return { game, events, ends, swaps };
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

describe('Specials in the game', () => {
  const duo = (g: Game, id: string, team: 'red' | 'blue', x: number, y: number) => {
    g.addTank({ id, team, crew: 2, driverId: `${id}d`, gunnerId: `${id}g` });
    g.teleport(id, x, y);
  };
  const driverMove = (over: Partial<NonNullable<PlayerInput['move']>> = {}): PlayerInput => ({
    seq: 1, move: { throttle: 0, turn: 0, boost: false, repair: false, ...over }, swap: false,
  });
  const special = (angle: number): PlayerInput => ({ seq: 1, aim: { angle, fire: false, special: true }, swap: false });
  const give = (g: Game, id: string, kind: 'explosive' | 'smoke' | 'piercing') => g.giveShells(id, kind, 3);

  it('driving over a pickup collects it (duo gets shells, solo does not), then it respawns after 20 s', () => {
    const { game, events } = setup();
    const p = map.pickups.find((x) => x.kind === 'explosive')!;
    duo(game, 'duo', 'red', p.x, p.y);
    game.addTank({ id: 'solo', team: 'blue', crew: 1, driverId: null, gunnerId: null });
    game.teleport('solo', p.x + 5, p.y);
    game.tick(DT, 1000);
    expect(events.find((e) => e.type === 'pickup')).toMatchObject({ tankId: 'duo', kind: 'explosive' });
    expect(tankOf(game, 'duo')).toMatchObject({ specialKind: 'explosive', specialAmmo: 3 });
    expect(tankOf(game, 'solo').specialAmmo).toBe(0);
    expect(game.snapshot().pickups.find((x) => x.x === p.x && x.y === p.y)?.active).toBe(false);
    game.teleport('solo', 10000, 10000);
    game.tick(DT, 1000 + 19_900);
    expect(game.snapshot().pickups.find((x) => x.x === p.x && x.y === p.y)?.active).toBe(false);
    game.tick(DT, 1000 + 20_100);
    expect(game.snapshot().pickups.find((x) => x.x === p.x && x.y === p.y)?.active).toBe(true);
  });

  it('repair kit heals a damaged solo tank', () => {
    const { game } = setup();
    const p = map.pickups.find((x) => x.kind === 'repair')!;
    game.addTank({ id: 'solo', team: 'red', crew: 1, driverId: null, gunnerId: null, hpBonus: 0 });
    game.teleport('solo', 100, 100);
    game.damageForTest('solo', 70, 'other');
    game.teleport('solo', p.x, p.y);
    game.tick(DT, 1000);
    expect(tankOf(game, 'solo').hp).toBe(100 - 70 + 40);
  });

  it('explosive shell: 30 damage to every enemy within 80 px, none to friends, event emitted', () => {
    const { game, events } = setup();
    duo(game, 'a', 'red', 300, 100);
    game.addTank({ id: 'e1', team: 'blue', crew: 1, driverId: null, gunnerId: null });
    game.addTank({ id: 'e2', team: 'blue', crew: 1, driverId: null, gunnerId: null });
    game.addTank({ id: 'f', team: 'red', crew: 1, driverId: null, gunnerId: null });
    game.teleport('e1', 500, 100);
    game.teleport('e2', 500, 150); // 50 px from e1, inside the blast
    game.teleport('f', 500, 130); // friend inside the blast
    give(game, 'a', 'explosive');
    game.setInput('a', 'gunner', special(0));
    let now = 1000;
    for (let i = 0; i < 40 && !events.some((e) => e.type === 'explode'); i++) game.tick(DT, (now += 33));
    expect(events.some((e) => e.type === 'explode')).toBe(true);
    expect(tankOf(game, 'e1').hp).toBe(100 - 30);
    expect(tankOf(game, 'e2').hp).toBe(100 - 30);
    expect(tankOf(game, 'f').hp).toBe(100);
    expect(tankOf(game, 'a').specialAmmo).toBe(2);
  });

  it('piercing shell deals 40 and does not bounce off walls', () => {
    const { game } = setup();
    duo(game, 'a', 'red', 300, 100);
    game.addTank({ id: 'e', team: 'blue', crew: 1, driverId: null, gunnerId: null });
    game.teleport('e', 500, 100);
    give(game, 'a', 'piercing');
    game.setInput('a', 'gunner', special(0));
    let now = 1000;
    for (let i = 0; i < 40 && tankOf(game, 'e').hp === 100; i++) game.tick(DT, (now += 33));
    expect(tankOf(game, 'e').hp).toBe(60);
    // fire into a wall: gone after the first impact (a normal shell would still be flying after bouncing)
    game.setInput('a', 'gunner', special(-Math.PI / 2));
    for (let i = 0; i < 60; i++) game.tick(DT, (now += 33));
    expect(game.snapshot().bullets.filter((b) => b.kind === 'piercing')).toHaveLength(0);
  });

  it('smoke shell creates a zone for 6 s', () => {
    const { game } = setup();
    duo(game, 'a', 'red', 300, 100);
    give(game, 'a', 'smoke');
    game.setInput('a', 'gunner', special(0));
    let now = 1000;
    for (let i = 0; i < 80 && game.snapshot().smokes.length === 0; i++) game.tick(DT, (now += 33));
    const z = game.snapshot().smokes[0]!;
    expect(z).toMatchObject({ r: 100 });
    game.setInput('a', 'gunner', special(-Math.PI / 2 + 0.0)); // keep firing smoke elsewhere is irrelevant; check expiry
    game.setInput('a', 'gunner', { seq: 2, aim: { angle: 0, fire: false, special: false }, swap: false });
    game.tick(DT, z.endsAt + 1);
    expect(game.snapshot().smokes.find((s) => s.id === z.id)).toBeUndefined();
  });

  it('boost: only duo tanks, 240 px/s for 1.5 s then 6 s cooldown', () => {
    const { game } = setup();
    duo(game, 'a', 'red', 400, 100);
    game.addTank({ id: 's', team: 'blue', crew: 1, driverId: null, gunnerId: null });
    game.teleport('s', 200, 300);
    const boosted = driverMove({ throttle: 1, boost: true });
    game.setInput('a', 'driver', boosted);
    game.setInput('s', 'driver', boosted);
    game.tick(0.1, 1000);
    expect(tankOf(game, 'a').x - 400).toBeCloseTo(24, 3); // 240 px/s
    expect(Math.abs(tankOf(game, 's').x - 200)).toBeCloseTo(16, 3); // solo: normal 160 px/s
    expect(tankOf(game, 'a').boostReadyAt).toBe(1000 + 6000);
    game.tick(0.1, 1000 + 1600); // boost over
    const x0 = tankOf(game, 'a').x;
    game.tick(0.1, 1000 + 1700);
    expect(tankOf(game, 'a').x - x0).toBeCloseTo(15, 3); // 150 px/s duo normal speed
  });

  it('holding R while standing still repairs; moving cancels it', () => {
    const { game } = setup();
    duo(game, 'a', 'red', 400, 100);
    game.damageForTest('a', 60, 'other');
    game.setInput('a', 'driver', driverMove({ repair: true }));
    game.tick(1, 1000);
    expect(tankOf(game, 'a').hp).toBe(130 - 60 + 15);
    game.setInput('a', 'driver', driverMove({ repair: true, throttle: 1 }));
    game.tick(1, 2000);
    expect(tankOf(game, 'a').hp).toBe(130 - 60 + 15);
  });

  it('both crew holding F for 0.5 s swap seats, the tank is frozen for 2 s, and a lone holder does nothing', () => {
    const { game, swaps } = setup();
    duo(game, 'a', 'red', 400, 100);
    const hold = (f: boolean): PlayerInput => ({ seq: 1, move: { throttle: 1, turn: 0, boost: false, repair: false }, aim: { angle: 0, fire: false, special: false }, swap: f });
    game.setInput('a', 'driver', hold(true));
    let now = 1000;
    for (let i = 0; i < 30; i++) game.tick(DT, (now += 33));
    expect(swaps).toHaveLength(0);
    game.setInput('a', 'gunner', hold(true));
    for (let i = 0; i < 20 && swaps.length === 0; i++) game.tick(DT, (now += 33));
    expect(swaps).toEqual(['a']);
    const x0 = tankOf(game, 'a').x;
    game.tick(DT, now + 1500); // still frozen (driver keeps pressing W)
    expect(tankOf(game, 'a').x).toBe(x0);
    game.setInput('a', 'driver', hold(false));
    game.setInput('a', 'gunner', hold(false));
    game.tick(DT, now + 2100);
    expect(tankOf(game, 'a').x).toBeGreaterThan(x0);
  });
});

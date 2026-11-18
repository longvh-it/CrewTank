import { describe, expect, it, vi } from 'vitest';
import type { Server } from 'socket.io';
import { readFileSync } from 'node:fs';
import { parseTiledMap } from '@crew-tanks/shared/map';
import { RESPAWN_DELAY_SEC, SPAWN_INVULNERABLE_SEC, TANK_STATS, TICK_HZ } from '@crew-tanks/shared/constants';
import type { ClientToServer, GameEvent, PlayerInput, ServerToClient } from '@crew-tanks/shared/types';
import { Game } from './Game';

const map = parseTiledMap(JSON.parse(readFileSync(new URL('./maps/arena-01.json', import.meta.url), 'utf8')));
const DT = 1 / TICK_HZ;

function setup() {
  const events: GameEvent[] = [];
  const io = { emit: vi.fn((name: string, e: GameEvent) => name === 'game:event' && events.push(e)) };
  const game = new Game(io as unknown as Server<ClientToServer, ServerToClient>, map);
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
  game.addTank('a'); // red
  game.addTank('b'); // blue
  game.teleport('a', 300, 100);
  game.teleport('b', 500, 100);
  return { game, events };
}

describe('Game shooting', () => {
  it('a hit costs BULLET_DAMAGE hp and emits hit', () => {
    const { game, events } = duel();
    game.setInput('a', aimFire(0, true));
    let now = 1000;
    for (let i = 0; i < 40 && !events.length; i++) game.tick(DT, (now += 33));
    expect(events[0]).toMatchObject({ type: 'hit', tankId: 'b', dmg: 20 });
    expect(tankOf(game, 'b').hp).toBe(TANK_STATS[1].maxHp - 20);
  });

  it('kills after enough hits, emits kill, respawns after delay with invulnerability', () => {
    const { game, events } = duel();
    game.setInput('a', aimFire(0, true));
    let now = 1000;
    while (!events.some((e) => e.type === 'kill') && now < 60_000) game.tick(DT, (now += 33));
    expect(events.find((e) => e.type === 'kill')).toEqual({ type: 'kill', killerTankId: 'a', victimTankId: 'b' });
    const dead = tankOf(game, 'b');
    expect(dead.alive).toBe(false);
    const diedAt = dead.respawnAt;
    expect(diedAt).not.toBeNull();
    game.setInput('a', aimFire(0, false));
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
    game.setInput('a', aimFire(0, true));
    game.setInvulnerable('b', 1e12);
    let now = 1000;
    for (let i = 0; i < 60; i++) game.tick(DT, (now += 33));
    expect(events.length).toBe(0);
    expect(tankOf(game, 'b').hp).toBe(TANK_STATS[1].maxHp);
  });

  it('no friendly fire: a teammate in the line of fire is not damaged', () => {
    const { game, events } = setup();
    game.addTank('a'); // red
    game.addTank('b'); // blue
    game.addTank('c'); // red
    game.teleport('a', 300, 100);
    game.teleport('c', 400, 100);
    game.teleport('b', 100, 600);
    game.setInput('a', aimFire(0, true));
    let now = 1000;
    for (let i = 0; i < 60; i++) game.tick(DT, (now += 33));
    expect(events.length).toBe(0);
    expect(tankOf(game, 'c').hp).toBe(TANK_STATS[1].maxHp);
  });

  it('respects reload time', () => {
    const { game } = duel();
    game.setInput('a', aimFire(Math.PI / 2, true)); // fire into the south cover, away from b
    let now = 1000;
    for (let i = 0; i < 10; i++) game.tick(DT, (now += 33)); // ~0.33 s < 0.8 s reload
    expect(game.snapshot().bullets.length).toBe(1);
  });

  it('bullets expire after their lifetime', () => {
    const { game } = duel();
    game.setInput('a', aimFire(-Math.PI / 2, true));
    game.tick(DT, 1000);
    game.setInput('a', aimFire(-Math.PI / 2, false));
    expect(game.snapshot().bullets.length).toBe(1);
    game.tick(DT, 1000 + 3001);
    expect(game.snapshot().bullets.length).toBe(0);
  });
});

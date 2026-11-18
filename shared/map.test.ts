import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { isSolid, parseTiledMap } from './map';
import { TANK_RADIUS, MAP_COLS, MAP_ROWS, TILE_SIZE } from './constants';

const arena = parseTiledMap(JSON.parse(readFileSync(new URL('../server/maps/arena-01.json', import.meta.url), 'utf8')));

describe('parseTiledMap(arena-01)', () => {
  it('has the expected size', () => {
    expect(arena.grid.cols).toBe(MAP_COLS);
    expect(arena.grid.rows).toBe(MAP_ROWS);
    expect(arena.grid.tileSize).toBe(TILE_SIZE);
  });
  it('is walled around the border and open in the middle of the spawn area', () => {
    expect(isSolid(arena.grid, 0, 0)).toBe(true);
    expect(isSolid(arena.grid, 39, 23)).toBe(true);
    expect(isSolid(arena.grid, 5, 12)).toBe(false);
  });
  it('treats out-of-range tiles as walls', () => expect(isSolid(arena.grid, -1, 5)).toBe(true));
  it('has spawns and pickups on open tiles with room for a tank', () => {
    expect(arena.spawns.red.length).toBeGreaterThanOrEqual(4);
    expect(arena.spawns.blue.length).toBeGreaterThanOrEqual(4);
    expect(arena.pickups.length).toBeGreaterThan(0);
    for (const p of [...arena.spawns.red, ...arena.spawns.blue, ...arena.pickups]) {
      const c = Math.floor(p.x / TILE_SIZE);
      const r = Math.floor(p.y / TILE_SIZE);
      expect(isSolid(arena.grid, c, r)).toBe(false);
      expect(TANK_RADIUS).toBeLessThanOrEqual(TILE_SIZE); // tank fits within neighbouring open tile
    }
  });
  it('rejects a map without the walls layer', () => {
    expect(() => parseTiledMap({ width: 1, height: 1, tilewidth: 32, layers: [] })).toThrow();
  });
});

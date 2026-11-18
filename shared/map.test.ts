import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AVAILABLE_MAP_IDS, MAP_COLS, MAP_ROWS, TANK_RADIUS, TILE_SIZE } from './constants';
import { isSolid, parseTiledMap } from './map';

const read = (id: string) => JSON.parse(readFileSync(new URL(`../server/maps/${id}.json`, import.meta.url), 'utf8'));

describe.each(AVAILABLE_MAP_IDS)('parseTiledMap(%s)', (id) => {
  const arena = parseTiledMap(read(id));

  it('has the expected size', () => {
    expect(arena.grid.cols).toBe(MAP_COLS);
    expect(arena.grid.rows).toBe(MAP_ROWS);
    expect(arena.grid.tileSize).toBe(TILE_SIZE);
  });
  it('is walled around the border and open in the spawn area', () => {
    expect(isSolid(arena.grid, 0, 0)).toBe(true);
    expect(isSolid(arena.grid, 39, 23)).toBe(true);
    expect(isSolid(arena.grid, 3, 12)).toBe(false);
  });
  it('treats out-of-range tiles as walls', () => expect(isSolid(arena.grid, -1, 5)).toBe(true));
  it('has spawns and pickups on open tiles with room for a tank', () => {
    expect(arena.spawns.red.length).toBeGreaterThanOrEqual(4);
    expect(arena.spawns.blue.length).toBeGreaterThanOrEqual(4);
    expect(arena.pickups.length).toBeGreaterThan(0);
    for (const p of [...arena.spawns.red, ...arena.spawns.blue, ...arena.pickups]) {
      expect(isSolid(arena.grid, Math.floor(p.x / TILE_SIZE), Math.floor(p.y / TILE_SIZE))).toBe(false);
      expect(TANK_RADIUS).toBeLessThanOrEqual(TILE_SIZE);
    }
  });
  it('has the four pickup kinds', () => {
    expect(new Set(arena.pickups.map((p) => p.kind))).toEqual(new Set(['explosive', 'piercing', 'smoke', 'repair']));
  });
  it('is fair: spawns and pickups mirror each other across the map centre', () => {
    const key = (p: { x: number; y: number }) => `${p.x},${p.y}`;
    const mirrored = new Set(arena.spawns.blue.map(key));
    for (const p of arena.spawns.red) expect(mirrored.has(`${MAP_COLS * TILE_SIZE - p.x},${p.y}`)).toBe(true);
  });
});

describe('parseTiledMap errors', () => {
  it('rejects a pickup with an unknown type', () => {
    const bad = read('arena-01');
    bad.layers.find((l: { name: string }) => l.name === 'pickups').objects[0].type = 'laser';
    expect(() => parseTiledMap(bad)).toThrow();
  });
  it('rejects a map without the walls layer', () => {
    expect(() => parseTiledMap({ width: 1, height: 1, tilewidth: 32, layers: [] })).toThrow();
  });
});

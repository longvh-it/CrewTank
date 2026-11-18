export interface Point {
  x: number;
  y: number;
}

/** Row-major solid-tile grid. `solid[row * cols + col] === 1` means wall. */
export interface CollisionGrid {
  cols: number;
  rows: number;
  tileSize: number;
  solid: Uint8Array;
}

export type PickupKind = 'explosive' | 'piercing' | 'smoke' | 'repair';
export const PICKUP_KINDS: readonly PickupKind[] = ['explosive', 'piercing', 'smoke', 'repair'];

export interface PickupSpawn extends Point {
  kind: PickupKind;
}

export interface MapData {
  grid: CollisionGrid;
  spawns: { red: Point[]; blue: Point[] };
  pickups: PickupSpawn[];
}

export function isSolid(grid: CollisionGrid, col: number, row: number): boolean {
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return true; // outside = wall
  return grid.solid[row * grid.cols + col] === 1;
}

interface TiledLayer {
  name?: unknown;
  type?: unknown;
  data?: unknown;
  objects?: unknown;
}

function asRecord(v: unknown, what: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null) throw new Error(`Invalid Tiled map: ${what}`);
  return v as Record<string, unknown>;
}

function findLayer(layers: TiledLayer[], name: string, type: string): TiledLayer {
  const layer = layers.find((l) => l.name === name && l.type === type);
  if (!layer) throw new Error(`Invalid Tiled map: missing ${type} layer "${name}"`);
  return layer;
}

function readObjects(layer: TiledLayer): Record<string, unknown>[] {
  if (!Array.isArray(layer.objects)) throw new Error(`Invalid Tiled map: layer "${String(layer.name)}" has no objects`);
  return layer.objects.map((o: unknown) => {
    const r = asRecord(o, 'object');
    if (typeof r.x !== 'number' || typeof r.y !== 'number') throw new Error('Invalid Tiled map: object without x/y');
    return r;
  });
}

function readPoints(layer: TiledLayer): Point[] {
  return readObjects(layer).map((r) => ({ x: r.x as number, y: r.y as number }));
}

/** Pickup points carry their kind in the Tiled object `type` field. */
function readPickups(layer: TiledLayer): PickupSpawn[] {
  return readObjects(layer).map((r) => {
    const kind = PICKUP_KINDS.find((k) => k === r.type);
    if (!kind) throw new Error(`Invalid Tiled map: pickup with unknown type "${String(r.type)}"`);
    return { x: r.x as number, y: r.y as number, kind };
  });
}

/**
 * Parse a Tiled JSON map. Layers: `walls` (tile layer, any non-zero gid = wall) and the object
 * layers `spawns_red`, `spawns_blue`, `pickups` (point objects, pixel coordinates).
 */
export function parseTiledMap(json: unknown): MapData {
  const m = asRecord(json, 'root');
  const cols = m.width;
  const rows = m.height;
  const tileSize = m.tilewidth;
  if (typeof cols !== 'number' || typeof rows !== 'number' || typeof tileSize !== 'number') {
    throw new Error('Invalid Tiled map: width/height/tilewidth');
  }
  if (!Array.isArray(m.layers)) throw new Error('Invalid Tiled map: layers');
  const layers = m.layers as TiledLayer[];

  const walls = findLayer(layers, 'walls', 'tilelayer');
  if (!Array.isArray(walls.data) || walls.data.length !== cols * rows) {
    throw new Error('Invalid Tiled map: walls data size');
  }
  const solid = new Uint8Array(cols * rows);
  walls.data.forEach((gid: unknown, i: number) => {
    solid[i] = typeof gid === 'number' && gid !== 0 ? 1 : 0;
  });

  return {
    grid: { cols, rows, tileSize, solid },
    spawns: {
      red: readPoints(findLayer(layers, 'spawns_red', 'objectgroup')),
      blue: readPoints(findLayer(layers, 'spawns_blue', 'objectgroup')),
    },
    pickups: readPickups(findLayer(layers, 'pickups', 'objectgroup')),
  };
}

import { parseTiledMap, type MapData } from '@crew-tanks/shared/map';
import arena01 from '../../../server/maps/arena-01.json';
import arena02 from '../../../server/maps/arena-02.json';

// Same Tiled files the server simulates against (server/maps/*.json).
const MAPS: Record<string, MapData> = {
  'arena-01': parseTiledMap(arena01),
  'arena-02': parseTiledMap(arena02),
};

export function getMap(mapId: string): MapData {
  const map = MAPS[mapId];
  if (!map) throw new Error(`Unknown map: ${mapId}`);
  return map;
}

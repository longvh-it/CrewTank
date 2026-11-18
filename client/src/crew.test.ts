import { describe, expect, it } from 'vitest';
import { crewInfo } from './crew';
import type { LobbyState, PlayerInfo } from '@crew-tanks/shared/types';

const p = (id: string, tankId: string | null, seat: 'driver' | 'gunner' | null): PlayerInfo => ({
  id, name: id.toUpperCase(), team: tankId ? 'red' : null, tankId, seat, isHost: false, connected: true,
});
const lobby: LobbyState = {
  code: 'ABCD', phase: 'playing',
  players: [p('a', 'red-1', 'driver'), p('b', 'red-1', 'gunner'), p('c', 'red-2', 'driver'), p('d', null, null)],
  tanks: [
    { id: 'red-1', team: 'red', driverId: 'a', gunnerId: 'b' },
    { id: 'red-2', team: 'red', driverId: 'c', gunnerId: null },
  ],
  settings: { killLimit: 15, timeLimitSec: 480, mapId: 'arena-01' },
};

describe('crewInfo', () => {
  it('driver of a duo sees the gunner as teammate', () =>
    expect(crewInfo(lobby, 'a')).toEqual({ tankId: 'red-1', role: 'driver', teammateName: 'B' }));
  it('gunner of a duo sees the driver as teammate', () =>
    expect(crewInfo(lobby, 'b')).toEqual({ tankId: 'red-1', role: 'gunner', teammateName: 'A' }));
  it('solo has no teammate', () =>
    expect(crewInfo(lobby, 'c')).toEqual({ tankId: 'red-2', role: 'solo', teammateName: null }));
  it('unseated or unknown players have no crew', () => {
    expect(crewInfo(lobby, 'd')).toBeNull();
    expect(crewInfo(lobby, 'zzz')).toBeNull();
  });
});

import { randomInt } from 'node:crypto';
import { DEFAULT_KILL_LIMIT, DEFAULT_MAP_ID, DEFAULT_TIME_LIMIT_SEC, EMPTY_ROOM_TTL_SEC, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@crew-tanks/shared/constants';
import type { LobbyState, PlayerInfo } from '@crew-tanks/shared/types';

export function generateRoomCode(): string {
  return Array.from({ length: ROOM_CODE_LENGTH }, () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)]).join('');
}

type Room = { state: LobbyState; sockets: Map<string, string>; cleanup?: NodeJS.Timeout };

export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  create(name: string, playerId: string, socketId: string): LobbyState {
    let code: string;
    do { code = generateRoomCode(); } while (this.rooms.has(code));
    const state: LobbyState = { code, phase: 'lobby', players: [], tanks: [], settings: { killLimit: DEFAULT_KILL_LIMIT, timeLimitSec: DEFAULT_TIME_LIMIT_SEC, mapId: DEFAULT_MAP_ID } };
    this.rooms.set(code, { state, sockets: new Map() });
    this.join(code, name, playerId, socketId);
    return state;
  }

  join(code: string, name: string, playerId: string, socketId: string): LobbyState | null {
    const room = this.rooms.get(code);
    if (!room || room.sockets.has(playerId) || [...room.sockets.values()].includes(socketId)) return null;
    if (room.cleanup) { clearTimeout(room.cleanup); delete room.cleanup; }
    const player: PlayerInfo = { id: playerId, name, team: null, tankId: null, seat: null, isHost: room.state.players.length === 0, connected: true };
    room.state.players.push(player);
    room.sockets.set(playerId, socketId);
    return room.state;
  }

  leave(code: string, socketId: string): LobbyState | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const entry = [...room.sockets].find(([, id]) => id === socketId);
    if (!entry) return null;
    room.sockets.delete(entry[0]);
    room.state.players = room.state.players.filter(player => player.id !== entry[0]);
    if (room.state.players.length === 0) {
      room.cleanup = setTimeout(() => this.rooms.delete(code), EMPTY_ROOM_TTL_SEC * 1000);
    } else if (!room.state.players.some(player => player.isHost)) {
      room.state.players[0]!.isHost = true;
    }
    return room.state;
  }

  get(code: string): LobbyState | undefined { return this.rooms.get(code)?.state; }
}

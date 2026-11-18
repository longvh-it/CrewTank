import { randomInt } from 'node:crypto';
import { DEFAULT_KILL_LIMIT, DEFAULT_MAP_ID, DEFAULT_TIME_LIMIT_SEC, EMPTY_ROOM_TTL_SEC, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@crew-tanks/shared/constants';
import { fillUnseated, matchTanks, normalizeTanks, seatPlayer, unseatPlayer } from '@crew-tanks/shared/lobby';
import { autoBalance } from '@crew-tanks/shared/teams';
import type { LobbySettings, LobbyState, PlayerInfo, Seat } from '@crew-tanks/shared/types';
import type { Game } from './Game';

export function generateRoomCode(): string {
  return Array.from({ length: ROOM_CODE_LENGTH }, () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)]).join('');
}

type Room = { state: LobbyState; sockets: Map<string, string>; game?: Game; cleanup?: NodeJS.Timeout };

export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  constructor(private readonly createGame: (code: string, mapId: string) => Game) {}

  /** `createGame(code, mapId)` builds a game wired to that room's socket.io channel. */
  create(name: string, playerId: string, socketId: string): LobbyState {
    let code: string;
    do { code = generateRoomCode(); } while (this.rooms.has(code));
    const state: LobbyState = { code, phase: 'lobby', players: [], tanks: normalizeTanks([]), settings: { killLimit: DEFAULT_KILL_LIMIT, timeLimitSec: DEFAULT_TIME_LIMIT_SEC, mapId: DEFAULT_MAP_ID } };
    this.rooms.set(code, { state, sockets: new Map() });
    this.join(code, name, playerId, socketId);
    return state;
  }

  join(code: string, name: string, playerId: string, socketId: string): LobbyState | null {
    const room = this.rooms.get(code);
    if (!room || room.state.phase !== 'lobby' || room.sockets.has(playerId) || [...room.sockets.values()].includes(socketId)) return null;
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
    const leaving = entry[0];
    room.state.players = room.state.players.filter(player => player.id !== leaving);
    if (room.state.phase === 'lobby') {
      room.state.tanks = unseatPlayer(room.state.players, room.state.tanks, leaving).tanks;
    } else {
      room.state.tanks = room.state.tanks.map(t => ({
        ...t,
        driverId: t.driverId === leaving ? null : t.driverId,
        gunnerId: t.gunnerId === leaving ? null : t.gunnerId,
      }));
      for (const t of room.state.tanks) if (!t.driverId && !t.gunnerId) room.game?.removeTank(t.id);
    }
    if (room.state.players.length === 0) {
      room.cleanup = setTimeout(() => {
        room.game?.stop();
        this.rooms.delete(code);
      }, EMPTY_ROOM_TTL_SEC * 1000);
    } else if (!room.state.players.some(player => player.isHost)) {
      room.state.players[0]!.isHost = true;
    }
    return room.state;
  }

  gameOf(code: string): Game | undefined { return this.rooms.get(code)?.game; }

  /** Tank and seat of the player behind this socket, once seated. */
  seatOf(code: string, socketId: string): { tankId: string; seat: Seat } | null {
    const room = this.rooms.get(code);
    const playerId = room && [...room.sockets].find(([, id]) => id === socketId)?.[0];
    const player = room?.state.players.find(p => p.id === playerId);
    return player?.tankId && player.seat ? { tankId: player.tankId, seat: player.seat } : null;
  }

  private lobbyRoom(code: string): Room | undefined {
    const room = this.rooms.get(code);
    return room?.state.phase === 'lobby' ? room : undefined;
  }

  private playerOf(room: Room, socketId: string): PlayerInfo | undefined {
    const playerId = [...room.sockets].find(([, id]) => id === socketId)?.[0];
    return room.state.players.find(p => p.id === playerId);
  }

  private apply(room: Room, seating: { players: PlayerInfo[]; tanks: LobbyState['tanks'] } | null): LobbyState | null {
    if (!seating) return null;
    room.state.players = seating.players;
    room.state.tanks = seating.tanks;
    return room.state;
  }

  pickSeat(code: string, socketId: string, tankId: string, seat: Seat): LobbyState | null {
    const room = this.lobbyRoom(code);
    const me = room && this.playerOf(room, socketId);
    if (!room || !me) return null;
    return this.apply(room, seatPlayer(room.state.players, room.state.tanks, me.id, tankId, seat));
  }

  leaveSeat(code: string, socketId: string): LobbyState | null {
    const room = this.lobbyRoom(code);
    const me = room && this.playerOf(room, socketId);
    if (!room || !me) return null;
    return this.apply(room, unseatPlayer(room.state.players, room.state.tanks, me.id));
  }

  /** Host only. */
  movePlayer(code: string, socketId: string, playerId: string, tankId: string, seat: Seat): LobbyState | null {
    const room = this.lobbyRoom(code);
    if (!room || !this.playerOf(room, socketId)?.isHost) return null;
    return this.apply(room, seatPlayer(room.state.players, room.state.tanks, playerId, tankId, seat));
  }

  /** Host only. */
  autoBalance(code: string, socketId: string): LobbyState | null {
    const room = this.lobbyRoom(code);
    if (!room || !this.playerOf(room, socketId)?.isHost) return null;
    const { players, tanks } = autoBalance(room.state.players);
    return this.apply(room, { players, tanks: normalizeTanks(tanks.map(({ hpBonus: _bonus, ...slot }) => slot)) });
  }

  /** Host only. */
  setSettings(code: string, socketId: string, patch: Partial<LobbySettings>): LobbyState | null {
    const room = this.lobbyRoom(code);
    if (!room || !this.playerOf(room, socketId)?.isHost) return null;
    room.state.settings = { ...room.state.settings, ...patch };
    return room.state;
  }

  /** Host only: seat everyone left, build the game from the occupied slots and start it. */
  start(code: string, socketId: string): LobbyState | null {
    const room = this.lobbyRoom(code);
    if (!room || !this.playerOf(room, socketId)?.isHost || room.state.players.length === 0) return null;
    this.apply(room, fillUnseated(room.state.players, room.state.tanks));
    const game = this.createGame(code, room.state.settings.mapId);
    for (const tank of matchTanks(room.state.players, room.state.tanks)) game.addTank(tank);
    game.start();
    room.game = game;
    room.state.phase = 'playing';
    return room.state;
  }

  get(code: string): LobbyState | undefined { return this.rooms.get(code)?.state; }
}

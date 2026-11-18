import express from 'express';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import type { ClientToServer, LobbyState, ServerToClient } from '@crew-tanks/shared/types';
import { SERVER_PORT } from '@crew-tanks/shared/constants';
import { parseTiledMap, type MapData } from '@crew-tanks/shared/map';
import { Game } from './Game';
import { parsePlayerInput, parseRoomCode, parseRoomPlayer, parseSeatMove, parseSeatPick, parseSettings, RateLimiter } from './validate';
import { RoomManager } from './RoomManager';

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServer, ServerToClient>(httpServer);

// Production: serve the built client.
const clientDist = fileURLToPath(new URL('../client/dist', import.meta.url));
if (existsSync(clientDist)) app.use(express.static(clientDist));

const maps = new Map<string, MapData>();
function loadMap(mapId: string): MapData {
  let map = maps.get(mapId);
  if (!map) {
    const file = fileURLToPath(new URL(`./maps/${mapId}.json`, import.meta.url));
    map = parseTiledMap(JSON.parse(readFileSync(file, 'utf8')));
    maps.set(mapId, map);
  }
  return map;
}
// One Game per room (created when the host starts the match); its snapshots and events go only to that room.
const rooms = new RoomManager(
  (code, settings) =>
    new Game(
      {
        state: (snapshot) => io.to(code).emit('game:state', snapshot),
        event: (e) => io.to(code).emit('game:event', e),
        end: (result) => {
          io.to(code).emit('game:end', result);
          const state = rooms.finish(code);
          if (state) io.to(code).emit('lobby:state', state);
        },
      },
      loadMap(settings.mapId),
      { killLimit: settings.killLimit, timeLimitSec: settings.timeLimitSec },
    ),
);

io.on('connection', (socket) => {
  console.log(`connected ${socket.id}`);
  let roomCode: string | null = null;
  socket.on('room:create', (name, playerId, ack) => {
    if (typeof ack !== 'function') return;
    const player = parseRoomPlayer(name, playerId);
    if (!player || roomCode) { ack({ ok: false, error: 'Thông tin không hợp lệ hoặc bạn đã ở trong phòng.' }); return; }
    const state = rooms.create(player.name, player.playerId, socket.id);
    roomCode = state.code;
    void socket.join(state.code);
    ack({ ok: true, code: state.code });
    io.to(state.code).emit('lobby:state', state);
  });
  socket.on('room:join', (code, name, playerId, ack) => {
    if (typeof ack !== 'function') return;
    const player = parseRoomPlayer(name, playerId);
    const validCode = parseRoomCode(code);
    if (!player || !validCode || roomCode) { ack({ ok: false, error: 'Thông tin không hợp lệ hoặc bạn đã ở trong phòng.' }); return; }
    const state = rooms.join(validCode, player.name, player.playerId, socket.id);
    if (!state) { ack({ ok: false, error: 'Phòng không tồn tại hoặc người chơi đã ở trong phòng.' }); return; }
    roomCode = validCode;
    void socket.join(validCode);
    ack({ ok: true });
    io.to(validCode).emit('lobby:state', state);
  });
  const publish = (state: LobbyState | null) => {
    if (state) io.to(state.code).emit('lobby:state', state);
  };
  socket.on('lobby:pickSeat', (tankId, seat) => {
    const pick = parseSeatPick(tankId, seat);
    if (roomCode && pick) publish(rooms.pickSeat(roomCode, socket.id, pick.tankId, pick.seat));
  });
  socket.on('lobby:leaveSeat', () => {
    if (roomCode) publish(rooms.leaveSeat(roomCode, socket.id));
  });
  socket.on('lobby:movePlayer', (playerId, tankId, seat) => {
    const move = parseSeatMove(playerId, tankId, seat);
    if (roomCode && move) publish(rooms.movePlayer(roomCode, socket.id, move.playerId, move.tankId, move.seat));
  });
  socket.on('lobby:autoBalance', () => {
    if (roomCode) publish(rooms.autoBalance(roomCode, socket.id));
  });
  socket.on('lobby:settings', (payload) => {
    const patch = parseSettings(payload);
    if (roomCode && patch) publish(rooms.setSettings(roomCode, socket.id, patch));
  });
  socket.on('lobby:start', () => {
    if (!roomCode) return;
    const state = rooms.start(roomCode, socket.id);
    if (!state) return;
    io.to(roomCode).emit('game:start', state.settings.mapId);
    publish(state);
  });
  socket.on('lobby:return', () => {
    if (roomCode) publish(rooms.returnToLobby(roomCode, socket.id));
  });
  const limiter = new RateLimiter();
  socket.on('game:input', (payload) => {
    if (!roomCode || !limiter.allow(Date.now())) return;
    const input = parsePlayerInput(payload);
    const seat = rooms.seatOf(roomCode, socket.id);
    if (input && seat) rooms.gameOf(roomCode)?.setInput(seat.tankId, seat.seat, input);
    else if (process.env.NODE_ENV !== 'production') console.warn(`invalid game:input from ${socket.id}`);
  });
  socket.on('disconnect', (reason) => {
    if (roomCode) {
      const state = rooms.leave(roomCode, socket.id);
      if (state) io.to(roomCode).emit('lobby:state', state);
    }
    console.log(`disconnected ${socket.id} (${reason})`);
  });
});

const port = Number(process.env.PORT) || SERVER_PORT;
httpServer.listen(port, () => console.log(`server listening on :${port}`));

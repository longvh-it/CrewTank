import express from 'express';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import type { ClientToServer, ServerToClient } from '@crew-tanks/shared/types';
import { DEFAULT_MAP_ID, SERVER_PORT } from '@crew-tanks/shared/constants';
import { parseTiledMap } from '@crew-tanks/shared/map';
import { Game } from './Game';
import { parsePlayerInput, parseRoomCode, parseRoomPlayer, RateLimiter } from './validate';
import { RoomManager } from './RoomManager';

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServer, ServerToClient>(httpServer);

// Production: serve the built client.
const clientDist = fileURLToPath(new URL('../client/dist', import.meta.url));
if (existsSync(clientDist)) app.use(express.static(clientDist));

const mapFile = fileURLToPath(new URL(`./maps/${DEFAULT_MAP_ID}.json`, import.meta.url));
const game = new Game(io, parseTiledMap(JSON.parse(readFileSync(mapFile, 'utf8'))));
game.start();
const rooms = new RoomManager();

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
  game.addTank(socket.id);
  const limiter = new RateLimiter();
  socket.on('game:input', (payload) => {
    if (!limiter.allow(Date.now())) return;
    const input = parsePlayerInput(payload);
    if (input) game.setInput(socket.id, input);
    else if (process.env.NODE_ENV !== 'production') console.warn(`invalid game:input from ${socket.id}`);
  });
  socket.on('disconnect', (reason) => {
    if (roomCode) {
      const state = rooms.leave(roomCode, socket.id);
      if (state) io.to(roomCode).emit('lobby:state', state);
    }
    game.removeTank(socket.id);
    console.log(`disconnected ${socket.id} (${reason})`);
  });
});

const port = Number(process.env.PORT) || SERVER_PORT;
httpServer.listen(port, () => console.log(`server listening on :${port}`));

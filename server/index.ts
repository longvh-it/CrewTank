import express from 'express';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import type { ClientToServer, ServerToClient } from '@crew-tanks/shared/types';
import { DEFAULT_MAP_ID, SERVER_PORT } from '@crew-tanks/shared/constants';
import { parseTiledMap } from '@crew-tanks/shared/map';
import { Game } from './Game';
import { parsePlayerInput, RateLimiter } from './validate';

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServer, ServerToClient>(httpServer);

// Production: serve the built client.
const clientDist = fileURLToPath(new URL('../client/dist', import.meta.url));
if (existsSync(clientDist)) app.use(express.static(clientDist));

const mapFile = fileURLToPath(new URL(`./maps/${DEFAULT_MAP_ID}.json`, import.meta.url));
const game = new Game(io, parseTiledMap(JSON.parse(readFileSync(mapFile, 'utf8'))));
game.start();

io.on('connection', (socket) => {
  console.log(`connected ${socket.id}`);
  game.addTank(socket.id);
  const limiter = new RateLimiter();
  socket.on('game:input', (payload) => {
    if (!limiter.allow(Date.now())) return;
    const input = parsePlayerInput(payload);
    if (input) game.setInput(socket.id, input);
    else if (process.env.NODE_ENV !== 'production') console.warn(`invalid game:input from ${socket.id}`);
  });
  socket.on('disconnect', (reason) => {
    game.removeTank(socket.id);
    console.log(`disconnected ${socket.id} (${reason})`);
  });
});

const port = Number(process.env.PORT) || SERVER_PORT;
httpServer.listen(port, () => console.log(`server listening on :${port}`));

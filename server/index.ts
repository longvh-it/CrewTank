import express from 'express';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import type { ClientToServer, ServerToClient } from '@crew-tanks/shared/types';
import { SERVER_PORT } from '@crew-tanks/shared/constants';

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServer, ServerToClient>(httpServer);

// Production: serve the built client.
const clientDist = fileURLToPath(new URL('../client/dist', import.meta.url));
if (existsSync(clientDist)) app.use(express.static(clientDist));

io.on('connection', (socket) => {
  console.log(`connected ${socket.id}`);
  socket.on('disconnect', (reason) => console.log(`disconnected ${socket.id} (${reason})`));
});

const port = Number(process.env.PORT) || SERVER_PORT;
httpServer.listen(port, () => console.log(`server listening on :${port}`));

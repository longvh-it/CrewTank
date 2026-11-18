import { io, type Socket } from 'socket.io-client';
import type { ClientToServer, ServerToClient } from '@crew-tanks/shared/types';

export type GameSocket = Socket<ServerToClient, ClientToServer>;

/** Same origin: Vite proxies /socket.io in dev, server serves the client in prod. */
export function createSocket(): GameSocket {
  return io();
}

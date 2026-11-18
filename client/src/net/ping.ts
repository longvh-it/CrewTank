import { PING_INTERVAL_MS } from '@crew-tanks/shared/constants';
import type { GameSocket } from './socket';

/** Measure round-trip time every PING_INTERVAL_MS while connected. Returns a stop function. */
export function startPing(socket: GameSocket, onRtt: (ms: number) => void): () => void {
  const timer = setInterval(() => {
    if (!socket.connected) return;
    const sent = performance.now();
    socket.emit('net:ping', () => onRtt(Math.round(performance.now() - sent)));
  }, PING_INTERVAL_MS);
  return () => clearInterval(timer);
}

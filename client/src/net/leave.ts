import type { GameSocket } from './socket';
import { clearRoom } from './session';
import { useStore } from '../store';

/** Leave the room for good: tell the server, forget the saved room (no auto-rejoin), go back to Home. */
export function leaveRoom(socket: GameSocket): void {
  socket.emit('room:leave');
  clearRoom();
  useStore.getState().setLobby(null);
}

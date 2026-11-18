import { useEffect, useState } from 'react';
import { createSocket, type GameSocket } from './net/socket';
import { GameCanvas } from './game/GameCanvas';

export function App() {
  const [socket, setSocket] = useState<GameSocket | null>(null);
  const [socketId, setSocketId] = useState<string | null>(null);

  useEffect(() => {
    const socket = createSocket();
    setSocket(socket);
    socket.on('connect', () => setSocketId(socket.id ?? null));
    socket.on('disconnect', () => setSocketId(null));
    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <>
      {socket && <GameCanvas socket={socket} />}
      <p style={{ position: 'fixed', top: 8, left: 8, margin: 0, color: '#fff' }}>
        {socketId ? `connected: ${socketId}` : 'connecting…'}
      </p>
    </>
  );
}

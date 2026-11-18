import { useEffect, useState } from 'react';
import { createSocket } from './net/socket';
import { GameCanvas } from './game/GameCanvas';

export function App() {
  const [socketId, setSocketId] = useState<string | null>(null);

  useEffect(() => {
    const socket = createSocket();
    socket.on('connect', () => setSocketId(socket.id ?? null));
    socket.on('disconnect', () => setSocketId(null));
    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <>
      <GameCanvas />
      <p style={{ position: 'fixed', top: 8, left: 8, margin: 0, color: '#fff' }}>
        {socketId ? `connected: ${socketId}` : 'connecting…'}
      </p>
    </>
  );
}

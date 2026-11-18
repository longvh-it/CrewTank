import { useEffect, useState } from 'react';
import { createSocket } from './net/socket';

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

  return <p>{socketId ? `connected: ${socketId}` : 'connecting…'}</p>;
}

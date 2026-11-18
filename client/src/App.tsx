import { useEffect, useState } from 'react';
import type { LobbyState } from '@crew-tanks/shared/types';
import { createSocket, type GameSocket } from './net/socket';
import { getPlayerId } from './net/playerId';
import { GameCanvas } from './game/GameCanvas';
import { Home } from './ui/Home';
import { Lobby } from './ui/Lobby';

export function App() {
  const [socket, setSocket] = useState<GameSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lobby, setLobby] = useState<LobbyState | null>(null);

  useEffect(() => {
    const connection = createSocket();
    setSocket(connection);
    connection.on('connect', () => setConnected(true));
    connection.on('disconnect', () => {
      setConnected(false);
      setLobby(null);
    });
    connection.on('lobby:state', setLobby);
    return () => {
      connection.disconnect();
    };
  }, []);

  if (!socket || !lobby) return <Home socket={socket} connected={connected} />;

  const playerId = getPlayerId();
  if (lobby.phase === 'lobby') return <Lobby lobby={lobby} playerId={playerId} socket={socket} />;

  const me = lobby.players.find((p) => p.id === playerId);
  return <GameCanvas socket={socket} mapId={lobby.settings.mapId} ownTankId={me?.tankId ?? null} />;
}

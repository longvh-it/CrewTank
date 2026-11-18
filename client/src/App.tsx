import { useEffect, useState } from 'react';
import { createSocket, type GameSocket } from './net/socket';
import { getPlayerId } from './net/playerId';
import { GameCanvas } from './game/GameCanvas';
import { Home } from './ui/Home';
import { Lobby } from './ui/Lobby';
import { Hud } from './ui/Hud';
import { crewInfo } from './crew';
import { useStore } from './store';

export function App() {
  const [socket, setSocket] = useState<GameSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const lobby = useStore((s) => s.lobby);
  const setLobby = useStore((s) => s.setLobby);

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
  }, [setLobby]);

  if (!socket || !lobby) return <Home socket={socket} connected={connected} />;

  const playerId = getPlayerId();
  if (lobby.phase === 'lobby') return <Lobby lobby={lobby} playerId={playerId} socket={socket} />;

  const crew = crewInfo(lobby, playerId);
  return (
    <>
      <GameCanvas socket={socket} mapId={lobby.settings.mapId} ownTankId={crew?.tankId ?? null} role={crew?.role ?? 'solo'} />
      <Hud crew={crew} />
    </>
  );
}

import { useEffect, useState } from 'react';
import { createSocket, type GameSocket } from './net/socket';
import { REJOIN_RETRIES, REJOIN_RETRY_MS } from '@crew-tanks/shared/constants';
import { getPlayerId } from './net/playerId';
import { startPing } from './net/ping';
import { clearRoom, loadRoom } from './net/session';
import { GameCanvas } from './game/GameCanvas';
import { Home } from './ui/Home';
import { Lobby } from './ui/Lobby';
import { Scoreboard } from './ui/Scoreboard';
import { Hud } from './ui/Hud';
import { crewInfo } from './crew';
import { useStore } from './store';

export function App() {
  const [socket, setSocket] = useState<GameSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const lobby = useStore((s) => s.lobby);
  const results = useStore((s) => s.results);
  const setLobby = useStore((s) => s.setLobby);
  const setResults = useStore((s) => s.setResults);
  const setPing = useStore((s) => s.setPing);

  useEffect(() => {
    const connection = createSocket();
    setSocket(connection);

    // After F5 or a network blip the socket has a new id: rejoin the saved room with the same playerId.
    // The old socket's disconnect may not have been processed yet, so retry a few times.
    let rejoinTimer: ReturnType<typeof setTimeout> | undefined;
    const rejoin = (attempt: number): void => {
      const saved = loadRoom();
      if (!saved) return;
      connection.emit('room:join', saved.code, saved.name, getPlayerId(), (result) => {
        if (result.ok) return;
        if (attempt + 1 < REJOIN_RETRIES) rejoinTimer = setTimeout(() => rejoin(attempt + 1), REJOIN_RETRY_MS);
        else {
          clearRoom();
          setLobby(null);
        }
      });
    };

    connection.on('connect', () => {
      setConnected(true);
      rejoin(0);
    });
    connection.on('disconnect', () => setConnected(false)); // keep the lobby on screen while reconnecting
    connection.on('lobby:state', setLobby);
    connection.on('game:end', setResults);
    const stopPing = startPing(connection, setPing);
    return () => {
      clearTimeout(rejoinTimer);
      stopPing();
      connection.disconnect();
    };
  }, [setLobby, setResults, setPing]);

  if (!socket || !lobby) return <Home socket={socket} connected={connected} />;
  const banner = connected ? null : (
    <div data-reconnecting style={{ position: 'fixed', top: 0, left: 0, right: 0, padding: 8, background: '#c0392b', color: '#fff', textAlign: 'center', zIndex: 10 }}>
      Mất kết nối, đang vào lại phòng… (ghế được giữ 30 giây)
    </div>
  );

  const playerId = getPlayerId();
  if (lobby.phase === 'lobby') return <>{banner}<Lobby lobby={lobby} playerId={playerId} socket={socket} /></>;

  if (lobby.phase === 'ended' && results) return <>{banner}<Scoreboard lobby={lobby} result={results} playerId={playerId} socket={socket} /></>;

  const crew = crewInfo(lobby, playerId);
  return (
    <>
      {banner}
      <GameCanvas socket={socket} mapId={lobby.settings.mapId} ownTankId={crew?.tankId ?? null} role={crew?.role ?? 'solo'} />
      <Hud crew={crew} />
    </>
  );
}

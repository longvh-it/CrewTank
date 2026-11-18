import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { PLAYER_NAME_MAX_LENGTH, ROOM_CODE_LENGTH } from '@crew-tanks/shared/constants';
import type { LobbyState } from '@crew-tanks/shared/types';
import { createSocket, type GameSocket } from './net/socket';

const PLAYER_ID_KEY = 'crew-tanks-player-id';
function getPlayerId(): string {
  const existing = localStorage.getItem(PLAYER_ID_KEY);
  if (existing) return existing;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  localStorage.setItem(PLAYER_ID_KEY, id);
  return id;
}

export function App() {
  const [socket, setSocket] = useState<GameSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '');
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const connection = createSocket();
    setSocket(connection);
    connection.on('connect', () => setConnected(true));
    connection.on('disconnect', () => { setConnected(false); setLobby(null); });
    connection.on('lobby:state', setLobby);
    return () => { connection.disconnect(); };
  }, []);

  function createRoom() {
    if (!socket || !connected) return;
    socket.emit('room:create', name, getPlayerId(), result => {
      if (!result.ok) setError(result.error);
      else { setCode(result.code); setError(''); }
    });
  }

  function joinRoom() {
    if (!socket || !connected) return;
    socket.emit('room:join', code.trim().toUpperCase(), name, getPlayerId(), result => {
      if (!result.ok) setError(result.error);
      else setError('');
    });
  }

  const roomUrl = lobby ? new URL(`/?room=${encodeURIComponent(lobby.code)}`, location.origin).href : '';
  return (
    <main>
      <h1>Crew Tanks</h1>
      {!connected && <p>Đang kết nối…</p>}
      {error && <p role="alert">{error}</p>}
      {lobby ? (
        <section>
          <h2>Phòng {lobby.code}</h2>
          <QRCodeSVG value={roomUrl} />
          <p><a href={roomUrl}>{roomUrl}</a></p>
          <ul>{lobby.players.map(player => <li key={player.id}>{player.name}{player.isHost ? ' (chủ phòng)' : ''}</li>)}</ul>
        </section>
      ) : (
        <section>
          <label>Tên <input value={name} maxLength={PLAYER_NAME_MAX_LENGTH} onChange={event => setName(event.target.value)} /></label>
          <button disabled={!connected || !name.trim()} onClick={createRoom}>Tạo phòng</button>
          <label>Mã phòng <input value={code} maxLength={ROOM_CODE_LENGTH} onChange={event => setCode(event.target.value.toUpperCase())} /></label>
          <button disabled={!connected || !name.trim() || code.trim().length !== ROOM_CODE_LENGTH} onClick={joinRoom}>Vào phòng</button>
        </section>
      )}
    </main>
  );
}

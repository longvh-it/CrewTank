import { useState } from 'react';
import { PLAYER_NAME_MAX_LENGTH, ROOM_CODE_LENGTH } from '@crew-tanks/shared/constants';
import type { GameSocket } from '../net/socket';
import { getPlayerId } from '../net/playerId';
import { saveRoom } from '../net/session';

export function Home({ socket, connected }: { socket: GameSocket | null; connected: boolean }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '');
  const [error, setError] = useState('');

  function createRoom() {
    socket?.emit('room:create', name, getPlayerId(), (result) => {
      if (result.ok) saveRoom({ code: result.code, name: name.trim() });
      setError(result.ok ? '' : result.error);
    });
  }
  function joinRoom() {
    const room = code.trim().toUpperCase();
    socket?.emit('room:join', room, name, getPlayerId(), (result) => {
      if (result.ok) saveRoom({ code: room, name: name.trim() });
      setError(result.ok ? '' : result.error);
    });
  }

  return (
    <main style={{ padding: 16 }}>
      <h1>Crew Tanks</h1>
      {!connected && <p>Đang kết nối…</p>}
      {error && <p role="alert">{error}</p>}
      <section>
        <label>
          Tên <input value={name} maxLength={PLAYER_NAME_MAX_LENGTH} onChange={(e) => setName(e.target.value)} />
        </label>
        <button disabled={!connected || !name.trim()} onClick={createRoom}>
          Tạo phòng
        </button>
        <label>
          Mã phòng{' '}
          <input value={code} maxLength={ROOM_CODE_LENGTH} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        </label>
        <button disabled={!connected || !name.trim() || code.trim().length !== ROOM_CODE_LENGTH} onClick={joinRoom}>
          Vào phòng
        </button>
      </section>
    </main>
  );
}

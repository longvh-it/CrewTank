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

  const canJoin = connected && !!name.trim() && code.trim().length === ROOM_CODE_LENGTH;
  return (
    <main className="screen screen-center">
      <div className="card home-card">
        <h1 className="logo">
          <span>Crew</span> <span>Tanks</span>
        </h1>
        <p className="tagline">Xe tăng 2D nhiều người chơi — lái và bắn cùng đồng đội</p>
        {!connected && <p className="status">Đang kết nối…</p>}
        {error && <p role="alert" className="alert">{error}</p>}
        <label className="field">
          Tên
          <input
            value={name}
            maxLength={PLAYER_NAME_MAX_LENGTH}
            placeholder="Nhập tên của bạn"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button className="primary big" disabled={!connected || !name.trim()} onClick={createRoom}>
          Tạo phòng
        </button>
        <div className="divider">hoặc</div>
        <label className="field">
          Mã phòng
          <div className="join-row">
            <input
              value={code}
              maxLength={ROOM_CODE_LENGTH}
              placeholder="ABCD"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <button disabled={!canJoin} onClick={joinRoom}>
              Vào phòng
            </button>
          </div>
        </label>
      </div>
    </main>
  );
}

import { useState, type DragEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  AVAILABLE_MAP_IDS,
  KILL_LIMIT_MAX,
  KILL_LIMIT_MIN,
  TIME_LIMIT_MAX_SEC,
  TIME_LIMIT_MIN_SEC,
} from '@crew-tanks/shared/constants';
import type { LobbySettings, LobbyState, PlayerInfo, Seat, TankSlot, TeamId } from '@crew-tanks/shared/types';
import type { GameSocket } from '../net/socket';

const TEAM_LABEL: Record<TeamId, string> = { red: 'Đội Đỏ', blue: 'Đội Xanh' };
const TEAM_COLOR: Record<TeamId, string> = { red: '#c0392b', blue: '#2980b9' };
const SEAT_LABEL: Record<Seat, string> = { driver: 'Lái xe', gunner: 'Pháo thủ' };
const DRAG_TYPE = 'text/player-id';

interface Props {
  lobby: LobbyState;
  playerId: string;
  socket: GameSocket;
}

export function Lobby({ lobby, playerId, socket }: Props) {
  const me = lobby.players.find((p) => p.id === playerId);
  const isHost = me?.isHost ?? false;
  const byId = new Map(lobby.players.map((p) => [p.id, p]));
  const unseated = lobby.players.filter((p) => !p.tankId);
  const roomUrl = new URL(`/?room=${encodeURIComponent(lobby.code)}`, location.origin).href;

  function onSeatClick(tank: TankSlot, seat: Seat, occupant: PlayerInfo | undefined) {
    if (!occupant) socket.emit('lobby:pickSeat', tank.id, seat);
    else if (occupant.id === playerId) socket.emit('lobby:leaveSeat');
  }

  function onDrop(e: DragEvent, tank: TankSlot, seat: Seat, occupant: PlayerInfo | undefined) {
    e.preventDefault();
    const dragged = e.dataTransfer.getData(DRAG_TYPE);
    if (isHost && dragged && !occupant) socket.emit('lobby:movePlayer', dragged, tank.id, seat);
  }

  function chip(p: PlayerInfo) {
    return (
      <span
        draggable={isHost}
        onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, p.id)}
        style={{ cursor: isHost ? 'grab' : 'default', fontWeight: p.id === playerId ? 700 : 400 }}
      >
        {p.name}
        {p.isHost ? ' ★' : ''}
      </span>
    );
  }

  function seatBox(tank: TankSlot, seat: Seat) {
    const occupantId = seat === 'driver' ? tank.driverId : tank.gunnerId;
    const occupant = occupantId ? byId.get(occupantId) : undefined;
    const mine = occupant?.id === playerId;
    return (
      <div
        key={seat}
        data-seat={`${tank.id}:${seat}`}
        onClick={() => onSeatClick(tank, seat, occupant)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => onDrop(e, tank, seat, occupant)}
        title={!occupant ? 'Bấm để ngồi' : mine ? 'Bấm để rời ghế' : undefined}
        style={{
          flex: 1,
          minHeight: 36,
          padding: 6,
          border: '1px dashed #888',
          background: occupant ? '#ffffff22' : 'transparent',
          cursor: !occupant || mine ? 'pointer' : 'default',
        }}
      >
        <small>{SEAT_LABEL[seat]}</small>
        <div>{occupant ? chip(occupant) : <em>Trống</em>}</div>
      </div>
    );
  }

  const setting = (patch: Partial<LobbySettings>) => socket.emit('lobby:settings', patch);
  const s = lobby.settings;

  return (
    <main style={{ padding: 16, color: '#fff', background: '#222', minHeight: '100vh' }}>
      <h1>Sảnh chờ — phòng {lobby.code}</h1>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <QRCodeSVG value={roomUrl} size={96} />
        <a href={roomUrl} style={{ color: '#9cf' }}>{roomUrl}</a>
      </div>

      <section style={{ display: 'flex', gap: 16, marginTop: 16 }}>
        {(['red', 'blue'] as const).map((team) => (
          <div key={team} data-team={team} style={{ flex: 1, border: `2px solid ${TEAM_COLOR[team]}`, padding: 8 }}>
            <h2 style={{ color: TEAM_COLOR[team] }}>{TEAM_LABEL[team]}</h2>
            {lobby.tanks
              .filter((t) => t.team === team)
              .map((tank, i) => (
                <div key={tank.id} style={{ marginBottom: 8 }}>
                  <small>Xe {i + 1}</small>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {seatBox(tank, 'driver')}
                    {seatBox(tank, 'gunner')}
                  </div>
                </div>
              ))}
          </div>
        ))}
      </section>

      <section data-unseated style={{ marginTop: 12 }}>
        <strong>Chưa có chỗ ({unseated.length}): </strong>
        {unseated.map((p) => (
          <span key={p.id} style={{ marginRight: 12 }}>{chip(p)}</span>
        ))}
        {isHost && <small> — kéo thả người vào ghế trống; ai chưa có chỗ sẽ được xếp tự động khi bắt đầu.</small>}
      </section>

      <section style={{ marginTop: 12, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <label>
          Số lượt hạ{' '}
          <input
            type="number" min={KILL_LIMIT_MIN} max={KILL_LIMIT_MAX} value={s.killLimit} disabled={!isHost}
            onChange={(e) => setting({ killLimit: Number(e.target.value) })}
          />
        </label>
        <label>
          Thời gian (phút){' '}
          <input
            type="number" min={TIME_LIMIT_MIN_SEC / 60} max={TIME_LIMIT_MAX_SEC / 60} value={s.timeLimitSec / 60} disabled={!isHost}
            onChange={(e) => setting({ timeLimitSec: Math.round(Number(e.target.value) * 60) })}
          />
        </label>
        <label>
          Map{' '}
          <select value={s.mapId} disabled={!isHost} onChange={(e) => setting({ mapId: e.target.value })}>
            {AVAILABLE_MAP_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
          </select>
        </label>
        {isHost && <button onClick={() => socket.emit('lobby:autoBalance')}>Tự chia đội</button>}
        {isHost && <button onClick={() => socket.emit('lobby:start')}>Bắt đầu</button>}
        {!isHost && <em>Chờ chủ phòng bắt đầu…</em>}
      </section>

      <p style={{ marginTop: 12 }}>
        <small>Điều khiển: WASD lái xe · chuột ngắm · chuột trái bắn. Xe 2 người: một người lái, một người pháo thủ.</small>
      </p>
    </main>
  );
}

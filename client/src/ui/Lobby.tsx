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
import { leaveRoom } from '../net/leave';
import { ControlsHelp } from './ControlsHelp';

const TEAM_LABEL: Record<TeamId, string> = { red: 'Đội Đỏ', blue: 'Đội Xanh' };
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
        className={`chip${p.id === playerId ? ' me' : ''}`}
        draggable={isHost}
        onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, p.id)}
        style={{ cursor: isHost ? 'grab' : 'default' }}
      >
        {p.name}
        {p.isHost ? ' ★' : ''}
        {p.connected ? '' : ' (mất kết nối)'}
      </span>
    );
  }

  function seatBox(tank: TankSlot, seat: Seat) {
    const occupantId = seat === 'driver' ? tank.driverId : tank.gunnerId;
    const occupant = occupantId ? byId.get(occupantId) : undefined;
    const mine = occupant?.id === playerId;
    const state = !occupant ? 'empty' : mine ? 'taken mine' : 'taken';
    return (
      <div
        key={seat}
        className={`seat ${state}`}
        data-seat={`${tank.id}:${seat}`}
        onClick={() => onSeatClick(tank, seat, occupant)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => onDrop(e, tank, seat, occupant)}
        title={!occupant ? 'Bấm để ngồi' : mine ? 'Bấm để rời ghế' : undefined}
      >
        <small>{SEAT_LABEL[seat]}</small>
        <div>{occupant ? chip(occupant) : <em>Trống</em>}</div>
      </div>
    );
  }

  const setting = (patch: Partial<LobbySettings>) => socket.emit('lobby:settings', patch);
  const s = lobby.settings;

  return (
    <main className="screen">
      <div className="lobby">
        <section className="card lobby-head">
          <div className="qr">
            <QRCodeSVG value={roomUrl} size={120} />
          </div>
          <div>
            <h1>Sảnh chờ — phòng {lobby.code}</h1>
            <div className="room-code">{lobby.code}</div>
            <a className="room-link" href={roomUrl}>{roomUrl}</a>
          </div>
          <button className="leave" onClick={() => leaveRoom(socket)}>Rời phòng</button>
        </section>

        <section className="teams">
          {(['red', 'blue'] as const).map((team) => (
            <div key={team} data-team={team} className="card team">
              <h2>{TEAM_LABEL[team]}</h2>
              {lobby.tanks
                .filter((t) => t.team === team)
                .map((tank, i) => (
                  <div key={tank.id}>
                    <div className="tank-label">Xe {i + 1}</div>
                    <div className="seats">
                      {seatBox(tank, 'driver')}
                      {seatBox(tank, 'gunner')}
                    </div>
                  </div>
                ))}
            </div>
          ))}
        </section>

        <section data-unseated className="card unseated">
          <strong>Chưa có chỗ ({unseated.length}):</strong>
          {unseated.map((p) => (
            <span key={p.id}>{chip(p)}</span>
          ))}
          {isHost && <span className="hint">Kéo thả người vào ghế trống; ai chưa có chỗ sẽ được xếp tự động khi bắt đầu.</span>}
        </section>

        <section className="card settings">
          <label className="field">
            Số lượt hạ
            <input
              type="number" min={KILL_LIMIT_MIN} max={KILL_LIMIT_MAX} value={s.killLimit} disabled={!isHost}
              onChange={(e) => setting({ killLimit: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            Thời gian (phút)
            <input
              type="number" min={TIME_LIMIT_MIN_SEC / 60} max={TIME_LIMIT_MAX_SEC / 60} value={s.timeLimitSec / 60} disabled={!isHost}
              onChange={(e) => setting({ timeLimitSec: Math.round(Number(e.target.value) * 60) })}
            />
          </label>
          <label className="field">
            Map
            <select value={s.mapId} disabled={!isHost} onChange={(e) => setting({ mapId: e.target.value })}>
              {AVAILABLE_MAP_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
          <div className="host-actions">
            {isHost && <button onClick={() => socket.emit('lobby:autoBalance')}>Tự chia đội</button>}
            {isHost && <button className="primary" onClick={() => socket.emit('lobby:start')}>Bắt đầu</button>}
            {!isHost && <em className="hint">Chờ chủ phòng bắt đầu…</em>}
          </div>
        </section>

        <ControlsHelp />
      </div>
    </main>
  );
}

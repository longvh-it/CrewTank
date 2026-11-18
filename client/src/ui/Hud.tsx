import { useEffect, useState } from 'react';
import type { CrewInfo } from '../crew';
import type { GameSocket } from '../net/socket';
import { leaveRoom } from '../net/leave';
import { useStore } from '../store';

const SPECIAL_LABEL = { normal: 'thường', explosive: 'nổ lan', piercing: 'xuyên giáp', smoke: 'khói' } as const;
const ROLE_LABEL = { solo: 'XE 1 NGƯỜI', driver: 'NGƯỜI LÁI', gunner: 'PHÁO THỦ' } as const;

export function Hud({ crew, socket }: { crew: CrewInfo | null; socket: GameSocket }) {
  const paused = useStore((s) => s.paused);
  const setPaused = useStore((s) => s.setPaused);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setConfirming(false);
      setPaused(!useStore.getState().paused);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      setPaused(false);
    };
  }, [setPaused]);
  const hp = useStore((s) => s.hud.hp);
  const maxHp = useStore((s) => s.hud.maxHp);
  const ping = useStore((s) => s.ping);
  const muted = useStore((s) => s.muted);
  const setMuted = useStore((s) => s.setMuted);
  const specialKind = useStore((s) => s.hud.specialKind);
  const specialAmmo = useStore((s) => s.hud.specialAmmo);
  const score = useStore((s) => s.score);
  const remainingSec = useStore((s) => s.remainingSec);
  const killFeed = useStore((s) => s.killFeed);
  const clock = `${Math.floor(remainingSec / 60)}:${String(remainingSec % 60).padStart(2, '0')}`;
  const low = maxHp > 0 && hp / maxHp <= 0.3;
  return (
    <div className="hud">
      <div data-hud-score className="hud-panel hud-score">
        <span className="red">Đỏ {score.red}</span>
        <span className="hud-clock">{clock}</span>
        <span className="blue">{score.blue} Xanh</span>
      </div>
      <div data-kill-feed className="hud-kills">
        {killFeed.map((k) => (
          <div key={k.id} className={k.killerTeam === 'red' ? 'red' : 'blue'}>
            {k.killer} ✕ {k.victim}
          </div>
        ))}
      </div>
      <div className="hud-panel hud-me">
        {crew && (
          <div data-hud-role className="hud-role">
            {crew.role === 'solo' ? `Bạn lái và bắn: ${ROLE_LABEL.solo}` : `Bạn là ${ROLE_LABEL[crew.role]}`}
            {crew.teammateName && <span className="muted"> · cùng xe: {crew.teammateName}</span>}
          </div>
        )}
        <div className={`hp-bar${low ? ' low' : ''}`}>
          <i style={{ width: `${maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0}%` }} />
        </div>
        <div data-hud-hp className="hud-hp-text">
          Máu: {hp}/{maxHp}
        </div>
        {specialKind && (
          <div data-hud-ammo className="hud-ammo">
            Đạn đặc biệt: {SPECIAL_LABEL[specialKind]} ×{specialAmmo} (chuột phải)
          </div>
        )}
        {crew && crew.role !== 'solo' && (
          <div className="hud-tip">Giữ F cùng đồng đội 0,5 s để đổi ghế · Lái: Shift tăng tốc, giữ R sửa xe khi đứng yên</div>
        )}
      </div>
      <div className="hud-panel hud-right">
        <span data-hud-ping>Ping: {ping === null ? '…' : `${ping} ms`}</span>
        <button data-menu title="Menu (Esc)" onClick={() => { setConfirming(false); setPaused(true); }}>☰</button>
        <button data-mute onClick={() => setMuted(!muted)}>
          {muted ? '🔇 Bật tiếng' : '🔊 Tắt tiếng'}
        </button>
      </div>
      {paused && (
        <div className="pause" data-pause>
          <div className="card pause-card">
            <h2>{confirming ? 'Rời trận?' : 'Tạm dừng'}</h2>
            {confirming ? (
              <>
                <p className="hint">Bạn sẽ rời phòng và mất ghế. Trận vẫn tiếp tục với những người còn lại.</p>
                <button className="danger big" onClick={() => leaveRoom(socket)}>Rời trận</button>
                <button className="big" onClick={() => setConfirming(false)}>Ở lại</button>
              </>
            ) : (
              <>
                <button className="primary big" onClick={() => setPaused(false)}>Tiếp tục</button>
                <button className="big" onClick={() => setMuted(!muted)}>{muted ? '🔇 Bật tiếng' : '🔊 Tắt tiếng'}</button>
                <button className="danger big" onClick={() => setConfirming(true)}>Rời trận</button>
                <p className="hint">Trận vẫn chạy trong lúc tạm dừng — xe của bạn đứng yên.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

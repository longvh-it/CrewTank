import type { CrewInfo } from '../crew';
import { useStore } from '../store';

const ROLE_LABEL = { solo: 'XE 1 NGƯỜI', driver: 'NGƯỜI LÁI', gunner: 'PHÁO THỦ' } as const;

export function Hud({ crew }: { crew: CrewInfo | null }) {
  const hp = useStore((s) => s.hud.hp);
  const maxHp = useStore((s) => s.hud.maxHp);
  const score = useStore((s) => s.score);
  const remainingSec = useStore((s) => s.remainingSec);
  const killFeed = useStore((s) => s.killFeed);
  const clock = `${Math.floor(remainingSec / 60)}:${String(remainingSec % 60).padStart(2, '0')}`;
  return (
    <div style={{ position: 'fixed', inset: 0, color: '#fff', textShadow: '0 0 3px #000', pointerEvents: 'none' }}>
      <div data-hud-score style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', fontSize: 22 }}>
        <span style={{ color: '#ff6b5b' }}>Đỏ {score.red}</span> · {clock} · <span style={{ color: '#5bb3ff' }}>{score.blue} Xanh</span>
      </div>
      <div data-kill-feed style={{ position: 'absolute', top: 8, right: 8, textAlign: 'right' }}>
        {killFeed.map((k) => (
          <div key={k.id} style={{ color: k.killerTeam === 'red' ? '#ff6b5b' : '#5bb3ff' }}>
            {k.killer} ✕ {k.victim}
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', top: 8, left: 8 }}>
      {crew && (
        <div data-hud-role>
          {crew.role === 'solo' ? `Bạn lái và bắn: ${ROLE_LABEL.solo}` : `Bạn là ${ROLE_LABEL[crew.role]}`}
          {crew.teammateName && <span> · cùng xe: {crew.teammateName}</span>}
        </div>
      )}
      <div data-hud-hp>
        Máu: {hp}/{maxHp}
      </div>
      </div>
    </div>
  );
}

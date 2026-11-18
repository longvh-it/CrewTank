import type { CrewInfo } from '../crew';
import { useStore } from '../store';

const ROLE_LABEL = { solo: 'XE 1 NGƯỜI', driver: 'NGƯỜI LÁI', gunner: 'PHÁO THỦ' } as const;

export function Hud({ crew }: { crew: CrewInfo | null }) {
  const hp = useStore((s) => s.hud.hp);
  const maxHp = useStore((s) => s.hud.maxHp);
  return (
    <div style={{ position: 'fixed', top: 8, left: 8, color: '#fff', textShadow: '0 0 3px #000', pointerEvents: 'none' }}>
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
  );
}

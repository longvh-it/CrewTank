import type { LobbyState, PlayerStats, TeamId } from '@crew-tanks/shared/types';
import type { MatchResult } from '@crew-tanks/shared/types';
import type { GameSocket } from '../net/socket';

const TEAM_LABEL: Record<TeamId, string> = { red: 'Đội Đỏ', blue: 'Đội Xanh' };
const TEAM_COLOR: Record<TeamId, string> = { red: '#c0392b', blue: '#2980b9' };

interface Props {
  lobby: LobbyState;
  result: MatchResult;
  playerId: string;
  socket: GameSocket;
}

function accuracy(s: PlayerStats): string {
  return s.shots === 0 ? '—' : `${Math.round((s.hits / s.shots) * 100)}%`;
}

export function Scoreboard({ lobby, result, playerId, socket }: Props) {
  const name = (id: string) => lobby.players.find((p) => p.id === id)?.name ?? '?';
  const teamOf = (id: string): TeamId => lobby.players.find((p) => p.id === id)?.team ?? 'red';
  const isHost = lobby.players.find((p) => p.id === playerId)?.isHost ?? false;
  const { awards } = result;
  const title = result.winner ? `${TEAM_LABEL[result.winner]} thắng!` : 'Hòa!';

  return (
    <main style={{ padding: 16, color: '#fff', background: '#222', minHeight: '100vh' }}>
      <h1 data-winner>{title}</h1>
      <h2>
        <span style={{ color: '#ff6b5b' }}>Đỏ {result.score.red}</span> — <span style={{ color: '#5bb3ff' }}>{result.score.blue} Xanh</span>
      </h2>

      {(['red', 'blue'] as const).map((team) => (
        <table key={team} data-team-table={team} style={{ width: '100%', marginBottom: 16, borderCollapse: 'collapse' }}>
          <caption style={{ textAlign: 'left', color: TEAM_COLOR[team], fontWeight: 700 }}>{TEAM_LABEL[team]}</caption>
          <thead>
            <tr>
              {['Người chơi', 'Hạ', 'Trợ giúp', 'Bị hạ', 'Sát thương', 'Bắn trúng'].map((h) => (
                <th key={h} style={{ textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.stats
              .filter((s) => teamOf(s.playerId) === team)
              .map((s) => (
                <tr key={s.playerId} style={{ fontWeight: s.playerId === playerId ? 700 : 400 }}>
                  <td>
                    {name(s.playerId)}
                    {awards.mvp === s.playerId ? ' 🏆 MVP' : ''}
                    {awards.bestDriver === s.playerId ? ' 🏎 Tay lái lụa' : ''}
                    {awards.bestDuo?.includes(s.playerId) ? ' 🤝 Cặp đôi ăn ý' : ''}
                  </td>
                  <td>{s.kills}</td>
                  <td>{s.assists}</td>
                  <td>{s.deaths}</td>
                  <td>{Math.round(s.damage)}</td>
                  <td>{accuracy(s)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      ))}

      <section data-awards>
        {awards.mvp && <p>🏆 MVP: {name(awards.mvp)}</p>}
        {awards.bestDriver && <p>🏎 Tay lái lụa: {name(awards.bestDriver)}</p>}
        {awards.bestDuo && <p>🤝 Cặp đôi ăn ý: {name(awards.bestDuo[0])} + {name(awards.bestDuo[1])}</p>}
      </section>

      {isHost ? (
        <button onClick={() => socket.emit('lobby:return')}>Về sảnh chờ</button>
      ) : (
        <em>Chờ chủ phòng đưa cả phòng về sảnh chờ…</em>
      )}
    </main>
  );
}

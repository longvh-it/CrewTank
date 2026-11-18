import type { LobbyState, PlayerStats, TeamId } from '@crew-tanks/shared/types';
import type { MatchResult } from '@crew-tanks/shared/types';
import type { GameSocket } from '../net/socket';
import { leaveRoom } from '../net/leave';

const TEAM_LABEL: Record<TeamId, string> = { red: 'Đội Đỏ', blue: 'Đội Xanh' };

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
    <main className="screen">
      <div className="scoreboard">
        <section className="winner" data-winner-team={result.winner ?? 'draw'}>
          <h1 data-winner className={result.winner ?? ''}>{title}</h1>
          <h2>
            <span className="red">Đỏ {result.score.red}</span> — <span className="blue">{result.score.blue} Xanh</span>
          </h2>
        </section>

        {(['red', 'blue'] as const).map((team) => (
          <div key={team} className="card">
            <table data-team-table={team} className="score-table">
              <caption className={team}>{TEAM_LABEL[team]}</caption>
              <thead>
                <tr>
                  {['Người chơi', 'Hạ', 'Trợ giúp', 'Bị hạ', 'Sát thương', 'Bắn trúng'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.stats
                  .filter((s) => teamOf(s.playerId) === team)
                  .map((s) => (
                    <tr key={s.playerId} className={s.playerId === playerId ? 'me' : undefined}>
                      <td>
                        {name(s.playerId)}
                        {awards.mvp === s.playerId && <span className="badge">🏆 MVP</span>}
                        {awards.bestDriver === s.playerId && <span className="badge">🏎 Tay lái lụa</span>}
                        {awards.bestDuo?.includes(s.playerId) && <span className="badge">🤝 Cặp đôi ăn ý</span>}
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
          </div>
        ))}

        <section data-awards className="awards">
          {awards.mvp && <p className="card award"><b>🏆 MVP</b><span>{name(awards.mvp)}</span></p>}
          {awards.bestDriver && <p className="card award"><b>🏎 Tay lái lụa</b><span>{name(awards.bestDriver)}</span></p>}
          {awards.bestDuo && <p className="card award"><b>🤝 Cặp đôi ăn ý</b><span>{name(awards.bestDuo[0])} + {name(awards.bestDuo[1])}</span></p>}
        </section>

        <div className="scoreboard-foot">
          {isHost ? (
            <button className="primary" onClick={() => socket.emit('lobby:return')}>Về sảnh chờ</button>
          ) : (
            <em className="hint">Chờ chủ phòng đưa cả phòng về sảnh chờ…</em>
          )}
          <button onClick={() => leaveRoom(socket)}>Rời phòng</button>
        </div>
      </div>
    </main>
  );
}

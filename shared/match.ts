import type { TeamId } from './types';

export interface MatchProgress {
  score: Record<TeamId, number>;
  killLimit: number;
  now: number;
  endsAt: number;
}

export type MatchOutcome = { over: false } | { over: true; winner: TeamId | null };

/**
 * Team Deathmatch: first team to `killLimit` wins; at `endsAt` the higher score wins,
 * equal scores are a draw (winner null).
 */
export function evaluateMatch({ score, killLimit, now, endsAt }: MatchProgress): MatchOutcome {
  if (score.red >= killLimit && score.red > score.blue) return { over: true, winner: 'red' };
  if (score.blue >= killLimit && score.blue > score.red) return { over: true, winner: 'blue' };
  if (now >= endsAt) {
    if (score.red === score.blue) return { over: true, winner: null };
    return { over: true, winner: score.red > score.blue ? 'red' : 'blue' };
  }
  return { over: false };
}

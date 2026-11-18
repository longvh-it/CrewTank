import type { PlayerInput } from '@crew-tanks/shared/types';

/** What this player controls: a solo tank takes both, a 2-crew tank splits driver / gunner. */
export type CrewRole = 'solo' | 'driver' | 'gunner';

/** Strip the parts of an input this role is not allowed to send (the server ignores them anyway). */
export function inputForRole(input: PlayerInput, role: CrewRole): PlayerInput {
  if (role === 'solo') return input;
  const { move, aim, ...rest } = input;
  if (role === 'driver' && move) return { ...rest, move };
  if (role === 'gunner' && aim) return { ...rest, aim };
  return rest;
}

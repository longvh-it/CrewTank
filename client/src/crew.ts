import type { LobbyState } from '@crew-tanks/shared/types';
import type { CrewRole } from './game/inputRole';

export interface CrewInfo {
  tankId: string;
  role: CrewRole;
  teammateName: string | null;
}

/** Derive this player's tank, role and teammate from the lobby (slots are fixed once the match starts). */
export function crewInfo(lobby: LobbyState, playerId: string): CrewInfo | null {
  const me = lobby.players.find((p) => p.id === playerId);
  const tank = me?.tankId ? lobby.tanks.find((t) => t.id === me.tankId) : undefined;
  if (!me || !tank || !me.seat) return null;
  const mateId = me.seat === 'driver' ? tank.gunnerId : tank.driverId;
  if (!mateId) return { tankId: tank.id, role: 'solo', teammateName: null };
  return {
    tankId: tank.id,
    role: me.seat,
    teammateName: lobby.players.find((p) => p.id === mateId)?.name ?? null,
  };
}

/** Display name of a tank: its crew's names joined with "+" (falls back to the tank id). */
export function tankLabel(lobby: LobbyState, tankId: string): string {
  const tank = lobby.tanks.find((t) => t.id === tankId);
  if (!tank) return tankId;
  const names = [tank.driverId, tank.gunnerId].flatMap((id) => lobby.players.find((p) => p.id === id)?.name ?? []);
  return names.length ? names.join('+') : tankId;
}

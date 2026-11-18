import { SHORTHANDED_HP_BONUS } from './constants';
import type { PlayerInfo, Seat, TankSlot, TeamId } from './types';

export interface BalancedTank extends TankSlot {
  hpBonus: number;
}

/** Assign players evenly to teams, pairing crew within each team. Does not mutate input. */
export function autoBalance(players: readonly PlayerInfo[]): { players: PlayerInfo[]; tanks: BalancedTank[] } {
  const teams: Record<TeamId, PlayerInfo[]> = { red: [], blue: [] };
  players.forEach((player, index) => teams[index % 2 === 0 ? 'red' : 'blue'].push(player));
  const tanks: BalancedTank[] = [];
  const assignments = new Map<string, { team: TeamId; tankId: string; seat: Seat }>();
  for (const team of ['red', 'blue'] as const) {
    const members = teams[team];
    for (let index = 0; index < members.length; index += 2) {
      const driver = members[index];
      if (!driver) continue;
      const gunner = members[index + 1];
      const id = `${team}-${Math.floor(index / 2) + 1}`;
      tanks.push({ id, team, driverId: driver.id, gunnerId: gunner?.id ?? null,
        hpBonus: players.length === 7 && members.length === 3 && !gunner ? SHORTHANDED_HP_BONUS : 0 });
      assignments.set(driver.id, { team, tankId: id, seat: 'driver' });
      if (gunner) assignments.set(gunner.id, { team, tankId: id, seat: 'gunner' });
    }
  }
  return { players: players.map(player => ({ ...player, ...assignments.get(player.id) })), tanks };
}

/** A player may pick an existing vacant seat, including their current seat. */
export function canPickSeat(players: readonly PlayerInfo[], tanks: readonly TankSlot[], playerId: string, tankId: string, seat: Seat): boolean {
  if (!players.some(player => player.id === playerId)) return false;
  const tank = tanks.find(candidate => candidate.id === tankId);
  if (!tank || (seat !== 'driver' && seat !== 'gunner')) return false;
  const occupant = seat === 'driver' ? tank.driverId : tank.gunnerId;
  return occupant === null || occupant === playerId;
}

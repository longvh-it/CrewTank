import { describe, expect, it } from 'vitest';
import { SHORTHANDED_HP_BONUS } from './constants';
import { autoBalance, canPickSeat } from './teams';
import type { PlayerInfo } from './types';

function makePlayers(count: number): PlayerInfo[] {
  return Array.from({ length: count }, (_, index) => ({ id: String(index), name: `P${index}`, team: null, tankId: null, seat: null, isHost: index === 0, connected: true }));
}

describe('autoBalance', () => {
  it.each([2, 3, 4, 5, 6, 7, 8])('assigns all %i players evenly without mutation', count => {
    const players = makePlayers(count);
    const result = autoBalance(players);
    expect(players.every(player => player.team === null)).toBe(true);
    const sizes = ['red', 'blue'].map(team => result.players.filter(player => player.team === team).length);
    expect(Math.abs(sizes[0]! - sizes[1]!)).toBeLessThanOrEqual(1);
    expect(result.tanks.flatMap(tank => [tank.driverId, tank.gunnerId].filter(Boolean))).toHaveLength(count);
    for (const player of result.players) {
      const tank = result.tanks.find(candidate => candidate.id === player.tankId);
      expect(tank?.team).toBe(player.team);
      expect(player.seat === 'driver' ? tank?.driverId : tank?.gunnerId).toBe(player.id);
    }
    for (const team of ['red', 'blue']) {
      const members = result.players.filter(player => player.team === team).length;
      expect(result.tanks.filter(tank => tank.team === team)).toHaveLength(Math.ceil(members / 2));
    }
    const bonuses = result.tanks.filter(tank => tank.hpBonus > 0);
    expect(bonuses).toHaveLength(count === 7 ? 1 : 0);
    if (count === 7) {
      expect(bonuses[0]?.hpBonus).toBe(SHORTHANDED_HP_BONUS);
      expect(bonuses[0]?.gunnerId).toBeNull();
      expect(result.players.filter(player => player.team === bonuses[0]?.team)).toHaveLength(3);
    }
  });
});

describe('canPickSeat', () => {
  it('accepts vacant or current seats and rejects occupied or unknown seats', () => {
    const { players, tanks } = autoBalance(makePlayers(3));
    const red = tanks.find(tank => tank.team === 'red')!;
    const blue = tanks.find(tank => tank.team === 'blue')!;
    expect(canPickSeat(players, tanks, '0', blue.id, 'gunner')).toBe(true);
    expect(canPickSeat(players, tanks, '0', red.id, 'driver')).toBe(true);
    expect(canPickSeat(players, tanks, '0', red.id, 'gunner')).toBe(false);
    expect(canPickSeat(players, tanks, 'unknown', blue.id, 'gunner')).toBe(false);
    expect(canPickSeat(players, tanks, '0', 'missing', 'driver')).toBe(false);
  });
});

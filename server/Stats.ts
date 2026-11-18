import {
  ASSIST_WINDOW_SEC,
  MVP_DAMAGE_PER_POINT,
  MVP_POINTS_PER_ASSIST,
  MVP_POINTS_PER_KILL,
} from '@crew-tanks/shared/constants';
import type { MatchResult, PlayerStats } from '@crew-tanks/shared/types';

export interface StatsTank {
  id: string;
  driverId: string | null;
  gunnerId: string | null;
}

interface PlayerRecord extends PlayerStats {
  hitsTaken: number;
}

interface TankRecord extends StatsTank {
  damage: number;
}

/**
 * Per-player match statistics. Kills, assists and deaths count for every crew member of the tank.
 * Shots, hits and damage dealt are credited to the shooter (the gunner, or the only player of a solo tank).
 * Hits taken are credited to the pilot (the driver, or the only player) for the "Tay lái lụa" award.
 */
export class Stats {
  private readonly players = new Map<string, PlayerRecord>();
  private readonly tanks = new Map<string, TankRecord>();
  /** victim tank -> (attacker tank -> time of last damage, ms) */
  private readonly recentDamage = new Map<string, Map<string, number>>();

  registerTank(tank: StatsTank): void {
    this.tanks.set(tank.id, { ...tank, damage: 0 });
    for (const id of [tank.driverId, tank.gunnerId]) {
      if (id && !this.players.has(id)) {
        this.players.set(id, { playerId: id, kills: 0, assists: 0, deaths: 0, damage: 0, shots: 0, hits: 0, hitsTaken: 0 });
      }
    }
  }

  private crewOf(tankId: string): PlayerRecord[] {
    const t = this.tanks.get(tankId);
    if (!t) return [];
    return [t.driverId, t.gunnerId].flatMap((id) => (id ? (this.players.get(id) ?? []) : []));
  }

  private shooterOf(tankId: string): PlayerRecord | undefined {
    const t = this.tanks.get(tankId);
    const id = t?.gunnerId ?? t?.driverId;
    return id ? this.players.get(id) : undefined;
  }

  private pilotOf(tankId: string): PlayerRecord | undefined {
    const t = this.tanks.get(tankId);
    const id = t?.driverId ?? t?.gunnerId;
    return id ? this.players.get(id) : undefined;
  }

  /** The crew traded seats: driver and gunner swap roles for the rest of the match. */
  swapSeats(tankId: string): void {
    const t = this.tanks.get(tankId);
    if (t) [t.driverId, t.gunnerId] = [t.gunnerId, t.driverId];
  }

  recordShot(tankId: string): void {
    const s = this.shooterOf(tankId);
    if (s) s.shots += 1;
  }

  /** `dmg` is the HP actually removed from the victim. */
  recordHit(attackerTankId: string, victimTankId: string, dmg: number, now: number): void {
    const shooter = this.shooterOf(attackerTankId);
    if (shooter) {
      shooter.hits += 1;
      shooter.damage += dmg;
    }
    const attacker = this.tanks.get(attackerTankId);
    if (attacker) attacker.damage += dmg;
    const pilot = this.pilotOf(victimTankId);
    if (pilot) pilot.hitsTaken += 1;
    let by = this.recentDamage.get(victimTankId);
    if (!by) this.recentDamage.set(victimTankId, (by = new Map()));
    by.set(attackerTankId, now);
  }

  recordKill(killerTankId: string, victimTankId: string, now: number): void {
    for (const p of this.crewOf(killerTankId)) p.kills += 1;
    for (const p of this.crewOf(victimTankId)) p.deaths += 1;
    for (const [attackerId, at] of this.recentDamage.get(victimTankId) ?? []) {
      if (attackerId === killerTankId || now - at > ASSIST_WINDOW_SEC * 1000) continue;
      for (const p of this.crewOf(attackerId)) p.assists += 1;
    }
    this.recentDamage.delete(victimTankId);
  }

  results(): PlayerStats[] {
    return [...this.players.values()].map(({ hitsTaken: _hitsTaken, ...stats }) => ({ ...stats }));
  }

  private points(p: PlayerRecord): number {
    return p.kills * MVP_POINTS_PER_KILL + p.assists * MVP_POINTS_PER_ASSIST + p.damage / MVP_DAMAGE_PER_POINT;
  }

  awards(elapsedSec: number): MatchResult['awards'] {
    const awards: MatchResult['awards'] = {};

    let best: PlayerRecord | undefined;
    for (const p of this.players.values()) if (!best || this.points(p) > this.points(best)) best = p;
    if (best && this.points(best) > 0) awards.mvp = best.playerId;

    // Tay lái lụa: fewest hits taken per minute among pilots.
    const minutes = elapsedSec / 60;
    if (minutes > 0) {
      let bestPilot: PlayerRecord | undefined;
      for (const id of this.tanks.keys()) {
        const pilot = this.pilotOf(id);
        if (pilot && (!bestPilot || pilot.hitsTaken < bestPilot.hitsTaken)) bestPilot = pilot;
      }
      if (bestPilot) awards.bestDriver = bestPilot.playerId;
    }

    // Cặp đôi ăn ý: the 2-crew tank that dealt the most damage.
    let bestDuo: TankRecord | undefined;
    for (const t of this.tanks.values()) {
      if (t.driverId && t.gunnerId && t.damage > 0 && (!bestDuo || t.damage > bestDuo.damage)) bestDuo = t;
    }
    if (bestDuo?.driverId && bestDuo.gunnerId) awards.bestDuo = [bestDuo.driverId, bestDuo.gunnerId];
    return awards;
  }
}

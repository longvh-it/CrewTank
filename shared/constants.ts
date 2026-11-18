// All tunable numbers. Source: docs/DESIGN.md. Units: px, seconds, degrees unless noted.

export const SERVER_PORT = 3000;
export const CLIENT_DEV_PORT = 5173;

// Network / loop (docs/ARCHITECTURE.md)
export const TICK_HZ = 30;
export const SNAPSHOT_EVERY_TICKS = 2; // 30 Hz / 2 ≈ 20 Hz broadcast
export const INPUT_SEND_HZ = 30;
export const MAX_INPUTS_PER_SEC = 40;
export const INTERP_DELAY_MS = 100;
export const RECONNECT_GRACE_SEC = 30;

// Rooms
export const ROOM_CODE_LENGTH = 4;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const EMPTY_ROOM_TTL_SEC = 5 * 60;

// Map / collision
export const TILE_SIZE = 32;
export const TANK_RADIUS = 18;
export const BULLET_MAX_SUBSTEP = 8;

// Tank stats by crew size
export interface TankStats {
  maxHp: number;
  speed: number; // px/s
  bodyTurnSpeed: number; // deg/s
  turretTurnSpeed: number; // deg/s
  reloadSec: number;
  maxSpecialAmmo: number; // 0 = cannot pick up special ammo
  canBoost: boolean;
}

export const TANK_STATS: Record<1 | 2, TankStats> = {
  1: { maxHp: 100, speed: 160, bodyTurnSpeed: 150, turretTurnSpeed: 180, reloadSec: 0.8, maxSpecialAmmo: 0, canBoost: false },
  2: { maxHp: 130, speed: 150, bodyTurnSpeed: 150, turretTurnSpeed: 270, reloadSec: 0.6, maxSpecialAmmo: 3, canBoost: true },
};

/** Solo tank on the 3-player team of a 7-player match gets +20% HP. */
export const SHORTHANDED_HP_BONUS = 0.2;

export const BOOST_SPEED = 240;
export const BOOST_DURATION_SEC = 1.5;
export const BOOST_COOLDOWN_SEC = 6;

export const REPAIR_HP_PER_SEC = 15;

export const SEAT_SWAP_HOLD_SEC = 0.5;
export const SEAT_SWAP_FREEZE_SEC = 2;

// Normal bullet
export const BULLET_SPEED = 400;
export const BULLET_DAMAGE = 20;
export const BULLET_MAX_BOUNCES = 2;
export const BULLET_LIFETIME_SEC = 3;
export const FRIENDLY_FIRE = false;

// Respawn / assist
export const RESPAWN_DELAY_SEC = 5;
export const SPAWN_INVULNERABLE_SEC = 2;
export const ASSIST_WINDOW_SEC = 5;

// Pickups
export const PICKUP_RESPAWN_SEC = 20;
export const EXPLOSIVE_RADIUS = 80;
export const EXPLOSIVE_DAMAGE = 30;
export const PIERCING_DAMAGE = 40;
export const PIERCING_MAX_BOUNCES = 0;
export const SMOKE_RADIUS = 100;
export const SMOKE_DURATION_SEC = 6;
export const REPAIR_KIT_HP = 40;

// Team Deathmatch
export const DEFAULT_KILL_LIMIT = 15;
export const KILL_LIMIT_MIN = 5;
export const KILL_LIMIT_MAX = 50;
export const DEFAULT_TIME_LIMIT_SEC = 8 * 60;
export const TIME_LIMIT_MIN_SEC = 3 * 60;
export const TIME_LIMIT_MAX_SEC = 15 * 60;
export const DEFAULT_MAP_ID = 'arena-01';

// Awards (MVP score)
export const MVP_POINTS_PER_KILL = 3;
export const MVP_POINTS_PER_ASSIST = 1;
export const MVP_DAMAGE_PER_POINT = 50;

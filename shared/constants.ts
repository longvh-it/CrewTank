// All tunable numbers. Source: docs/DESIGN.md. Units: px, seconds, degrees unless noted.

export const SERVER_PORT = 3000;
export const CLIENT_DEV_PORT = 5173;

// Network / loop (docs/ARCHITECTURE.md)
export const TICK_HZ = 30;
export const SNAPSHOT_HZ = 20; // independent timer: 30 Hz ticks cannot divide evenly into 20 Hz
export const INPUT_SEND_HZ = 30;
export const MAX_INPUTS_PER_SEC = 40;
export const INTERP_DELAY_MS = 100;
export const INTERP_BUFFER_SIZE = 30; // snapshots kept (~1.5 s at 20 Hz)
export const CLOCK_SYNC_SMOOTHING = 0.1; // EMA weight for the server-clock offset estimate
export const RECONNECT_GRACE_SEC = 30;

// Rooms
export const ROOM_CODE_LENGTH = 4;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const EMPTY_ROOM_TTL_SEC = 5 * 60;
export const PLAYER_NAME_MAX_LENGTH = 40;

// Map / collision
export const TILE_SIZE = 32;
export const TANK_RADIUS = 18;
export const BULLET_MAX_SUBSTEP = 8;
export const MAP_COLS = 40;
export const MAP_ROWS = 24;
export const WORLD_WIDTH = MAP_COLS * TILE_SIZE;
export const WORLD_HEIGHT = MAP_ROWS * TILE_SIZE;

// Sprites (Kenney Topdown Tanks, drawn facing up) and effects
export const BARREL_LENGTH = 26; // muzzle distance from the tank centre (bullets spawn here)
export const TANK_SPRITE_SCALE = 0.5; // 75x70 source -> ~38x35 px body
export const BARREL_SPRITE_SCALE = 0.5; // 16x50 source -> 8x25 px barrel
export const BARREL_PIVOT_Y = 0.9; // barrel rotates about a point near its base
export const BULLET_SPRITE_SCALE = 0.5;
export const SPRITE_FACING_OFFSET = Math.PI / 2; // sprites face up, game angle 0 = east
export const EXPLOSION_FRAMES = 6;
export const EXPLOSION_FRAME_MS = 60;
export const EXPLOSION_SPRITE_PX = 87; // source frame size
export const KILL_EXPLOSION_RADIUS = 40;
export const HIT_SHAKE_MS = 150;
export const HIT_SHAKE_INTENSITY = 0.01;
export const SFX_VOLUME = 0.35;

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
export const BULLET_RADIUS = 4; // hit radius against tanks; walls use the bullet centre
export const BULLET_MAX_BOUNCES = 2;
export const BULLET_LIFETIME_SEC = 3;
export const FRIENDLY_FIRE = false;

// Client feedback
export const KILL_FEED_MAX = 5;
export const HIT_FLASH_MS = 150;
export const HP_BAR_WIDTH = 36;
export const HP_BAR_HEIGHT = 5;
export const HP_BAR_OFFSET_Y = 30;
export const INVULNERABLE_BLINK_MS = 120;

// Respawn / assist
export const RESPAWN_DELAY_SEC = 5;
export const SPAWN_INVULNERABLE_SEC = 2;
export const ASSIST_WINDOW_SEC = 5;

// Pickups
export const PICKUP_RESPAWN_SEC = 20;
export const PICKUP_RADIUS = 14;
export const AMMO_PER_PICKUP = 3; // special shells granted by one ammo pickup (capped by maxSpecialAmmo)
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
export const AVAILABLE_MAP_IDS: readonly string[] = ['arena-01', 'arena-02'];
export const MAX_TANKS_PER_TEAM = 4; // 8 players max, 2 per tank, 2 teams

// Awards (MVP score)
export const MVP_POINTS_PER_KILL = 3;
export const MVP_POINTS_PER_ASSIST = 1;
export const MVP_DAMAGE_PER_POINT = 50;

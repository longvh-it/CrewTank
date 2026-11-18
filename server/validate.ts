import { z } from 'zod';
import {
  AVAILABLE_MAP_IDS,
  KILL_LIMIT_MAX,
  KILL_LIMIT_MIN,
  MAX_INPUTS_PER_SEC,
  PLAYER_NAME_MAX_LENGTH,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  TIME_LIMIT_MAX_SEC,
  TIME_LIMIT_MIN_SEC,
} from '@crew-tanks/shared/constants';
import type { LobbySettings, PlayerInput, Seat } from '@crew-tanks/shared/types';

const axis = z.union([z.literal(-1), z.literal(0), z.literal(1)]);
const roomPlayerSchema = z.object({ name: z.string().trim().min(1).max(PLAYER_NAME_MAX_LENGTH), playerId: z.string().uuid() });
const roomCodeSchema = z.string().length(ROOM_CODE_LENGTH).refine(code => [...code].every(char => ROOM_CODE_ALPHABET.includes(char)));

export function parseRoomPlayer(name: unknown, playerId: unknown) {
  const result = roomPlayerSchema.safeParse({ name, playerId });
  return result.success ? result.data : null;
}

export function parseRoomCode(code: unknown): string | null {
  const result = roomCodeSchema.safeParse(code);
  return result.success ? result.data : null;
}

const playerInputSchema = z.object({
  seq: z.number().int().nonnegative(),
  move: z
    .object({ throttle: axis, turn: axis, boost: z.boolean(), repair: z.boolean() })
    .strict()
    .optional(),
  aim: z
    .object({ angle: z.number().finite(), fire: z.boolean(), special: z.boolean() })
    .strict()
    .optional(),
  swap: z.boolean(),
});

/** Returns the parsed input, or null when the payload is invalid. */
export function parsePlayerInput(payload: unknown): PlayerInput | null {
  const r = playerInputSchema.safeParse(payload);
  return r.success ? r.data : null;
}

/** Fixed one-second window limiter, one instance per socket. */
export class RateLimiter {
  private windowStart = 0;
  private count = 0;

  constructor(private readonly maxPerSec: number = MAX_INPUTS_PER_SEC) {}

  allow(nowMs: number): boolean {
    if (nowMs - this.windowStart >= 1000) {
      this.windowStart = nowMs;
      this.count = 0;
    }
    this.count += 1;
    return this.count <= this.maxPerSec;
  }
}

const seatSchema = z.enum(['driver', 'gunner']);
const tankIdSchema = z.string().min(1).max(16);
const seatPickSchema = z.object({ tankId: tankIdSchema, seat: seatSchema });
const seatMoveSchema = z.object({ playerId: z.string().uuid(), tankId: tankIdSchema, seat: seatSchema });
const settingsSchema = z
  .object({
    killLimit: z.number().int().min(KILL_LIMIT_MIN).max(KILL_LIMIT_MAX),
    timeLimitSec: z.number().int().min(TIME_LIMIT_MIN_SEC).max(TIME_LIMIT_MAX_SEC),
    mapId: z.string().refine((id) => AVAILABLE_MAP_IDS.includes(id)),
  })
  .partial()
  .strict();

export function parseSeatPick(tankId: unknown, seat: unknown): { tankId: string; seat: Seat } | null {
  const r = seatPickSchema.safeParse({ tankId, seat });
  return r.success ? r.data : null;
}

export function parseSeatMove(playerId: unknown, tankId: unknown, seat: unknown): { playerId: string; tankId: string; seat: Seat } | null {
  const r = seatMoveSchema.safeParse({ playerId, tankId, seat });
  return r.success ? r.data : null;
}

export function parseSettings(payload: unknown): Partial<LobbySettings> | null {
  const r = settingsSchema.safeParse(payload);
  if (!r.success) return null;
  const out: Partial<LobbySettings> = {};
  if (r.data.killLimit !== undefined) out.killLimit = r.data.killLimit;
  if (r.data.timeLimitSec !== undefined) out.timeLimitSec = r.data.timeLimitSec;
  if (r.data.mapId !== undefined) out.mapId = r.data.mapId;
  return out;
}

import { z } from 'zod';
import { MAX_INPUTS_PER_SEC } from '@crew-tanks/shared/constants';
import type { PlayerInput } from '@crew-tanks/shared/types';

const axis = z.union([z.literal(-1), z.literal(0), z.literal(1)]);

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

import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPlayerId } from './playerId';

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getPlayerId', () => {
  it('creates and persists unique v4 IDs without randomUUID', () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    vi.stubGlobal('crypto', {
      randomUUID: undefined,
      getRandomValues: webcrypto.getRandomValues.bind(webcrypto),
    });

    const first = getPlayerId();
    expect(first).toMatch(uuidV4);
    expect(getPlayerId()).toBe(first);
    storage.clear();
    const second = getPlayerId();
    expect(second).toMatch(uuidV4);
    expect(second).not.toBe(first);
  });

  it('uses randomUUID when available', () => {
    const randomUUID = vi.fn(() => 'native-uuid');
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
    vi.stubGlobal('crypto', { randomUUID });

    expect(getPlayerId()).toBe('native-uuid');
    expect(randomUUID).toHaveBeenCalledOnce();
  });
});

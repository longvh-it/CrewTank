const ROOM_KEY = 'crew-tanks-room';

export interface SavedRoom {
  code: string;
  name: string;
}

/** The room this tab is in, kept in sessionStorage so F5 (or a network blip) can rejoin it. */
export function saveRoom(room: SavedRoom): void {
  sessionStorage.setItem(ROOM_KEY, JSON.stringify(room));
}

export function loadRoom(): SavedRoom | null {
  try {
    const raw = sessionStorage.getItem(ROOM_KEY);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    if (typeof v === 'object' && v !== null && 'code' in v && 'name' in v && typeof v.code === 'string' && typeof v.name === 'string') {
      return { code: v.code, name: v.name };
    }
  } catch {
    // corrupt value: treat as no saved room
  }
  return null;
}

export function clearRoom(): void {
  sessionStorage.removeItem(ROOM_KEY);
}

const PLAYER_ID_KEY = 'crew-tanks-player-id';

/** Stable id kept in localStorage (not the socket id), sent when creating/joining a room. */
export function getPlayerId(): string {
  const existing = localStorage.getItem(PLAYER_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(PLAYER_ID_KEY, id);
  return id;
}

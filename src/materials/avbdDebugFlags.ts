/**
 * AVBD debug flags, read from the URL only.
 *
 * These briefly persisted to localStorage to survive Safari's URL stomping during the Vision Pro
 * NaN debugging, but a stored `avbdbvh=0` outliving the session silently disabled the broadphase
 * on the headset and paused every large scene. Flags now apply per page load; the old store is
 * cleared so previously affected devices recover on next visit.
 */
const LEGACY_STORE_KEY = 'kora.debug.avbd';

if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem(LEGACY_STORE_KEY);
  } catch {
    /* ignore */
  }
}

export function debugParam(name: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

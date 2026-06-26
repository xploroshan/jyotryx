/**
 * Lightweight, opt-in geolocation helpers for the "find a temple near me"
 * remedy action. Nothing is stored server-side — the coordinates only bias a
 * maps search opened in a new tab. Shaped so a live nearby-list (OSM/Places)
 * can replace `mapsSearchUrl` later without changing callers.
 */
export interface Coords {
  lat: number;
  lng: number;
}

/**
 * Resolve the browser's current position. Never rejects — resolves `null` when
 * geolocation is unsupported, denied, or times out, so callers can fall back to
 * a plain (un-centered) search.
 */
export function getCurrentPosition(timeoutMs = 8000): Promise<Coords | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 10 * 60 * 1000 },
    );
  });
}

/**
 * Build a Google Maps search URL for `query`. When `coords` are supplied the
 * search is centered near the user so the nearest matching temples surface
 * first; otherwise it's a plain query the user can run from their default
 * location.
 */
export function mapsSearchUrl(query: string, coords?: Coords | null): string {
  const q = encodeURIComponent(query);
  if (coords) {
    return `https://www.google.com/maps/search/${q}/@${coords.lat},${coords.lng},12z`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

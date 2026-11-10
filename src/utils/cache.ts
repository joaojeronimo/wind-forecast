/**
 * LocalStorage caching utility for Open-Meteo prediction API requests.
 * Caches responses keyed by their canonical request URL with a 15-minute TTL.
 */

export interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

export const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Normalizes a URL by sorting query parameters so cache keys are canonical and deterministic.
 */
export function getCanonicalUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    parsed.searchParams.sort();
    return parsed.toString();
  } catch {
    return urlStr;
  }
}

/**
 * Determines whether a localStorage key is an Open-Meteo cached request.
 */
export function isOpenMeteoCacheKey(key: string): boolean {
  return (
    key.startsWith('https://api.open-meteo.com') ||
    key.startsWith('https://geocoding-api.open-meteo.com') ||
    key.startsWith('openmeteo_cache:')
  );
}

/**
 * Safely accesses localStorage. Returns null if unavailable (e.g., in restricted iframe or SSR).
 */
function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage;
  }
  return null;
}

/**
 * Retrieves cached API data for a given URL if it exists and has not exceeded its TTL.
 */
export function getCachedData<T>(
  url: string,
  ttlMs: number = CACHE_TTL_MS
): CacheEntry<T> | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const canonicalKey = getCanonicalUrl(url);
    const raw = storage.getItem(canonicalKey);
    if (!raw) return null;

    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (!entry || typeof entry.timestamp !== 'number' || entry.data === undefined) {
      storage.removeItem(canonicalKey);
      return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > ttlMs || age < 0) {
      storage.removeItem(canonicalKey);
      return null;
    }

    return entry;
  } catch (err) {
    console.warn('Failed to read from localStorage cache:', err);
    return null;
  }
}

/**
 * Prunes expired Open-Meteo cache entries from localStorage to free up quota.
 */
export function pruneExpiredCache(ttlMs: number = CACHE_TTL_MS): number {
  const storage = getStorage();
  if (!storage) return 0;

  let prunedCount = 0;
  try {
    const now = Date.now();
    const keysToRemove: string[] = [];

    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && isOpenMeteoCacheKey(key)) {
        try {
          const raw = storage.getItem(key);
          if (raw) {
            const entry = JSON.parse(raw);
            if (!entry || typeof entry.timestamp !== 'number' || now - entry.timestamp > ttlMs || now - entry.timestamp < 0) {
              keysToRemove.push(key);
            }
          }
        } catch {
          keysToRemove.push(key);
        }
      }
    }

    for (const key of keysToRemove) {
      storage.removeItem(key);
      prunedCount++;
    }
  } catch (err) {
    console.warn('Failed to prune expired cache:', err);
  }
  return prunedCount;
}

/**
 * Saves API response data into localStorage with current timestamp and the canonical URL as the key.
 * Handles storage quota limits automatically by pruning expired entries or clearing older cache if needed.
 */
export function setCachedData<T>(url: string, data: T): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    const canonicalKey = getCanonicalUrl(url);
    const entry: CacheEntry<T> = {
      timestamp: Date.now(),
      data
    };
    const serialized = JSON.stringify(entry);

    try {
      storage.setItem(canonicalKey, serialized);
    } catch {
      // Storage quota might be exceeded. Prune expired entries first.
      pruneExpiredCache();
      try {
        storage.setItem(canonicalKey, serialized);
      } catch {
        // If still full, clear all existing open-meteo entries and try once more
        clearOpenMeteoCache();
        try {
          storage.setItem(canonicalKey, serialized);
        } catch (finalErr) {
          console.warn('Unable to cache response in localStorage due to storage limits:', finalErr);
        }
      }
    }
  } catch (err) {
    console.warn('Failed to serialize and save to localStorage cache:', err);
  }
}

/**
 * Deletes cached data for a specific URL.
 */
export function deleteCachedData(url: string): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    const canonicalKey = getCanonicalUrl(url);
    storage.removeItem(canonicalKey);
  } catch (err) {
    console.warn('Failed to delete cache entry for URL:', err);
  }
}

/**
 * Clears all Open-Meteo cache entries from localStorage while preserving user settings and other data.
 * Returns the number of entries deleted.
 */
export function clearOpenMeteoCache(): number {
  const storage = getStorage();
  if (!storage) return 0;

  let clearedCount = 0;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && isOpenMeteoCacheKey(key)) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      storage.removeItem(key);
      clearedCount++;
    }
  } catch (err) {
    console.warn('Failed to clear Open-Meteo cache:', err);
  }
  return clearedCount;
}

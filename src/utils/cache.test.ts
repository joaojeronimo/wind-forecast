import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';
import {
  getCachedData,
  setCachedData,
  deleteCachedData,
  clearOpenMeteoCache,
  pruneExpiredCache,
  getCanonicalUrl,
  isOpenMeteoCacheKey,
  CACHE_TTL_MS
} from './cache';

class MockStorage implements Storage {
  private store: Map<string, string> = new Map();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

describe('Open-Meteo Cache Utility', () => {
  const sampleUrl = 'https://api.open-meteo.com/v1/forecast?latitude=38.7167&longitude=-9.1390&models=best_match,gfs_seamless';
  const sampleData = {
    latitude: 38.7167,
    longitude: -9.1390,
    hourly: {
      time: ['2026-11-10T12:00:00Z'],
      wind_gusts_10m_best_match: [25.4]
    }
  };

  beforeAll(() => {
    const mockStorage = new MockStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true
    });
    (globalThis as any).window = {
      localStorage: mockStorage
    };
  });

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('normalizes URL search params into canonical sorted order', () => {
    const url1 = 'https://api.open-meteo.com/v1/forecast?b=2&a=1&c=3';
    const url2 = 'https://api.open-meteo.com/v1/forecast?c=3&a=1&b=2';
    expect(getCanonicalUrl(url1)).toBe(getCanonicalUrl(url2));
    expect(getCanonicalUrl(url1)).toBe('https://api.open-meteo.com/v1/forecast?a=1&b=2&c=3');
  });

  it('identifies Open-Meteo cache keys properly', () => {
    expect(isOpenMeteoCacheKey('https://api.open-meteo.com/v1/forecast?lat=1&lon=2')).toBe(true);
    expect(isOpenMeteoCacheKey('https://geocoding-api.open-meteo.com/v1/search?name=Lisbon')).toBe(true);
    expect(isOpenMeteoCacheKey('https://single-runs-api.open-meteo.com/v1/forecast?models=ecmwf_ifs025&run=2026-11-10T06:00')).toBe(true);
    expect(isOpenMeteoCacheKey('wind_forecast_settings')).toBe(false);
    expect(isOpenMeteoCacheKey('wind_forecast_last_location')).toBe(false);
  });

  it('saves data to localStorage using the canonical URL as key', () => {
    setCachedData(sampleUrl, sampleData);
    const canonical = getCanonicalUrl(sampleUrl);
    const storedRaw = localStorage.getItem(canonical);
    expect(storedRaw).not.toBeNull();

    const parsed = JSON.parse(storedRaw!);
    expect(parsed.data).toEqual(sampleData);
    expect(typeof parsed.timestamp).toBe('number');
  });

  it('retrieves cached data if within the 15-minute TTL', () => {
    setCachedData(sampleUrl, sampleData);
    const cached = getCachedData<typeof sampleData>(sampleUrl);
    expect(cached).not.toBeNull();
    expect(cached?.data).toEqual(sampleData);
    expect(Date.now() - (cached?.timestamp ?? 0)).toBeLessThan(1000);
  });

  it('matches cache even if query params are provided in a different order', () => {
    const permutedUrl = 'https://api.open-meteo.com/v1/forecast?models=best_match,gfs_seamless&longitude=-9.1390&latitude=38.7167';
    setCachedData(sampleUrl, sampleData);

    const hit = getCachedData<typeof sampleData>(permutedUrl);
    expect(hit).not.toBeNull();
    expect(hit?.data).toEqual(sampleData);
  });

  it('returns null and removes entry if TTL (15 minutes) has expired', () => {
    setCachedData(sampleUrl, sampleData);

    // Fast-forward time past 15 minutes
    const futureTime = Date.now() + CACHE_TTL_MS + 1000;
    vi.spyOn(Date, 'now').mockReturnValue(futureTime);

    const cached = getCachedData<typeof sampleData>(sampleUrl);
    expect(cached).toBeNull();

    // Verify it was evicted from storage
    expect(localStorage.getItem(getCanonicalUrl(sampleUrl))).toBeNull();
  });

  it('deletes a specific URL from cache', () => {
    setCachedData(sampleUrl, sampleData);
    expect(getCachedData(sampleUrl)).not.toBeNull();

    deleteCachedData(sampleUrl);
    expect(getCachedData(sampleUrl)).toBeNull();
  });

  it('clears all Open-Meteo cache entries while preserving settings and other keys', () => {
    localStorage.setItem('wind_forecast_settings', JSON.stringify({ speedUnit: 'knots' }));
    localStorage.setItem('wind_forecast_last_location', JSON.stringify({ name: 'Lisbon' }));

    setCachedData('https://api.open-meteo.com/v1/forecast?lat=1', { test: 1 });
    setCachedData('https://api.open-meteo.com/v1/forecast?lat=2', { test: 2 });

    expect(localStorage.length).toBe(4);

    const clearedCount = clearOpenMeteoCache();
    expect(clearedCount).toBe(2);

    expect(localStorage.getItem('wind_forecast_settings')).not.toBeNull();
    expect(localStorage.getItem('wind_forecast_last_location')).not.toBeNull();
    expect(getCachedData('https://api.open-meteo.com/v1/forecast?lat=1')).toBeNull();
    expect(getCachedData('https://api.open-meteo.com/v1/forecast?lat=2')).toBeNull();
  });

  it('prunes expired entries while keeping active entries', () => {
    const baseNow = 1700000000000;
    vi.spyOn(Date, 'now').mockReturnValue(baseNow);

    setCachedData('https://api.open-meteo.com/v1/forecast?lat=old', { old: true });

    // Advance 10 minutes (within 15m)
    vi.spyOn(Date, 'now').mockReturnValue(baseNow + 10 * 60 * 1000);
    setCachedData('https://api.open-meteo.com/v1/forecast?lat=new', { new: true });

    // Advance to 16 minutes after first entry
    vi.spyOn(Date, 'now').mockReturnValue(baseNow + 16 * 60 * 1000);

    const pruned = pruneExpiredCache();
    expect(pruned).toBe(1);

    expect(getCachedData('https://api.open-meteo.com/v1/forecast?lat=old')).toBeNull();
    expect(getCachedData('https://api.open-meteo.com/v1/forecast?lat=new')).not.toBeNull();
  });
});

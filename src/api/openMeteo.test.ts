import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';
import { fetchWindForecast } from './openMeteo';
import { clearOpenMeteoCache } from '../utils/cache';

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

describe('fetchWindForecast caching integration', () => {
  const mockApiResponse = {
    latitude: 38.7167,
    longitude: -9.139,
    timezone: 'Europe/Lisbon',
    elevation: 50,
    hourly: {
      time: ['2026-11-10T12:00', '2026-11-10T13:00'],
      wind_gusts_10m_best_match: [30, 35],
      wind_speed_10m_best_match: [20, 22],
      wind_direction_10m_best_match: [340, 350],
      temperature_2m_best_match: [18, 19]
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

  it('fetches from network on initial call and caches in localStorage', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse
    } as Response);

    const result1 = await fetchWindForecast(38.7167, -9.139, 'Lisbon', ['best_match']);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result1.isCached).toBe(false);

    // Verify it was stored in localStorage
    expect(localStorage.length).toBe(1);

    // Second call with same parameters should read from cache without network request
    const result2 = await fetchWindForecast(38.7167, -9.139, 'Lisbon', ['best_match']);

    expect(fetchSpy).toHaveBeenCalledTimes(1); // Still 1!
    expect(result2.isCached).toBe(true);
    expect(result2.latitude).toBe(38.7167);
  });

  it('forceRefresh bypasses cache and makes a new request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse
    } as Response);

    // Initial fetch
    await fetchWindForecast(38.7167, -9.139, 'Lisbon', ['best_match']);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Fetch with forceRefresh: true
    const refreshedResult = await fetchWindForecast(
      38.7167,
      -9.139,
      'Lisbon',
      ['best_match'],
      3,
      { forceRefresh: true }
    );

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(refreshedResult.isCached).toBe(false);
  });

  it('clearing cache forces subsequent requests to hit network again', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse
    } as Response);

    await fetchWindForecast(38.7167, -9.139, 'Lisbon', ['best_match']);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Clear cache
    clearOpenMeteoCache();
    expect(localStorage.length).toBe(0);

    // Next request must hit network
    const resultAfterClear = await fetchWindForecast(38.7167, -9.139, 'Lisbon', ['best_match']);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(resultAfterClear.isCached).toBe(false);
  });

  it('correctly handles single-model response without model suffix', async () => {
    const singleModelResponse = {
      latitude: 38.7167,
      longitude: -9.139,
      timezone: 'Europe/Lisbon',
      elevation: 50,
      hourly: {
        time: ['2026-11-10T12:00', '2026-11-10T13:00'],
        wind_gusts_10m: [42, 45],
        wind_speed_10m: [25, 28],
        wind_direction_10m: [180, 190],
        temperature_2m: [20, 21]
      }
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => singleModelResponse
    } as Response);

    const result = await fetchWindForecast(38.7167, -9.139, 'Lisbon', ['ecmwf_ifs025']);
    expect(result.hours.length).toBeGreaterThan(0);
    expect(result.hours[0].reportingModelsCount).toBe(1);
    expect(result.hours[0].modelValues.ecmwf_ifs025?.gust).toBe(42);
    expect(result.hours[0].modelValues.ecmwf_ifs025?.speed).toBe(25);
    expect(result.hours[0].modelValues.ecmwf_ifs025?.direction).toBe(180);
  });
});

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  DEFAULT_PRESET_LOCATIONS,
  PRESET_LOCATIONS,
  getPopularSpots,
  getCachedSearches,
  addSearchedSpot,
  clearCachedSearches,
  isSameLocation,
  isLocationActive,
  SEARCHED_SPOTS_STORAGE_KEY
} from './presets';
import { LocationInfo } from '../types';

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

describe('Popular Spots Presets and Caching', () => {
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
  });

  it('has Ericeira as the first preset spot with correct coordinates and name', () => {
    expect(DEFAULT_PRESET_LOCATIONS[0]).toBeDefined();
    expect(DEFAULT_PRESET_LOCATIONS[0].name).toBe('Ericeira');
    expect(DEFAULT_PRESET_LOCATIONS[0].latitude).toBe(38.9627);
    expect(DEFAULT_PRESET_LOCATIONS[0].longitude).toBe(-9.4156);
  });

  it('has Lisbon as the second preset spot with correct coordinates and name', () => {
    expect(DEFAULT_PRESET_LOCATIONS[1]).toBeDefined();
    expect(DEFAULT_PRESET_LOCATIONS[1].name).toBe('Lisbon');
    expect(DEFAULT_PRESET_LOCATIONS[1].latitude).toBe(38.7251);
    expect(DEFAULT_PRESET_LOCATIONS[1].longitude).toBe(-9.1498);
  });

  it('has only Ericeira and Lisbon by default (nothing else)', () => {
    expect(DEFAULT_PRESET_LOCATIONS.length).toBe(2);
    expect(PRESET_LOCATIONS.length).toBe(2);
    const spots = getPopularSpots();
    expect(spots.length).toBe(2);
    expect(spots[0].name).toBe('Ericeira');
    expect(spots[1].name).toBe('Lisbon');
  });

  it('populates popular spots with user searches and caches them in localStorage', () => {
    const spotA: LocationInfo = {
      name: 'Peniche',
      latitude: 39.3558,
      longitude: -9.3811,
      country: 'Portugal'
    };

    const afterAdd = addSearchedSpot(spotA);
    expect(afterAdd.length).toBe(3);
    expect(afterAdd[0].name).toBe('Ericeira');
    expect(afterAdd[1].name).toBe('Lisbon');
    expect(afterAdd[2].name).toBe('Peniche');

    // Verify localStorage has cached the search
    const cached = getCachedSearches();
    expect(cached.length).toBe(1);
    expect(cached[0].name).toBe('Peniche');
    expect(cached[0].latitude).toBe(39.3558);
    expect(cached[0].longitude).toBe(-9.3811);

    // Verify raw localStorage key
    const raw = localStorage.getItem(SEARCHED_SPOTS_STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)[0].name).toBe('Peniche');

    // Verify getPopularSpots reflects the cached search
    const popular = getPopularSpots();
    expect(popular.length).toBe(3);
    expect(popular[2].name).toBe('Peniche');
  });

  it('does not duplicate default spots (Ericeira or Lisbon) when searched', () => {
    const searchEriceira: LocationInfo = {
      name: 'Ericeira',
      latitude: 38.9627,
      longitude: -9.4156
    };
    const searchLisbon: LocationInfo = {
      name: 'Lisbon',
      latitude: 38.7251,
      longitude: -9.1498
    };

    addSearchedSpot(searchEriceira);
    addSearchedSpot(searchLisbon);

    const spots = getPopularSpots();
    expect(spots.length).toBe(2);
    expect(getCachedSearches().length).toBe(0);
  });

  it('does not duplicate existing searched spots', () => {
    const spotA: LocationInfo = {
      name: 'Cascais',
      latitude: 38.6979,
      longitude: -9.4215
    };

    addSearchedSpot(spotA);
    addSearchedSpot(spotA);

    const spots = getPopularSpots();
    expect(spots.length).toBe(3);
    expect(spots[2].name).toBe('Cascais');
    expect(getCachedSearches().length).toBe(1);
  });

  it('handles multiple searches in order and caches them', () => {
    const spot1: LocationInfo = { name: 'Peniche', latitude: 39.3558, longitude: -9.3811 };
    const spot2: LocationInfo = { name: 'Nazaré', latitude: 39.6012, longitude: -9.0684 };
    const spot3: LocationInfo = { name: 'Sagres', latitude: 37.0086, longitude: -8.9397 };

    addSearchedSpot(spot1);
    addSearchedSpot(spot2);
    addSearchedSpot(spot3);

    const spots = getPopularSpots();
    expect(spots.length).toBe(5);
    expect(spots.map(s => s.name)).toEqual(['Ericeira', 'Lisbon', 'Peniche', 'Nazaré', 'Sagres']);
  });

  it('isLocationActive correctly identifies active spots by name or coordinates', () => {
    const ericeira = DEFAULT_PRESET_LOCATIONS[0];
    const lisbon = DEFAULT_PRESET_LOCATIONS[1];

    expect(isLocationActive(ericeira, { name: 'Ericeira', latitude: 38.9627, longitude: -9.4156 })).toBe(true);
    expect(isLocationActive(ericeira, { name: 'Spot (38.96°, -9.42°)', latitude: 38.9627, longitude: -9.4156 })).toBe(true);
    expect(isLocationActive(lisbon, { name: 'Ericeira', latitude: 38.9627, longitude: -9.4156 })).toBe(false);
  });

  it('clears cached searches properly', () => {
    addSearchedSpot({ name: 'Peniche', latitude: 39.3558, longitude: -9.3811 });
    expect(getCachedSearches().length).toBe(1);
    clearCachedSearches();
    expect(getCachedSearches().length).toBe(0);
    expect(getPopularSpots().length).toBe(2);
  });
});

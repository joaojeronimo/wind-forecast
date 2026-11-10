import { LocationInfo } from '../types';

export const DEFAULT_PRESET_LOCATIONS: LocationInfo[] = [
  {
    name: 'Ericeira',
    latitude: 38.9627,
    longitude: -9.4156,
    country: 'Portugal',
    admin1: 'Lisbon District',
    timezone: 'Europe/Lisbon'
  },
  {
    name: 'Lisbon',
    latitude: 38.7251,
    longitude: -9.1498,
    country: 'Portugal',
    admin1: 'Lisbon District',
    timezone: 'Europe/Lisbon'
  }
];

// Kept for backward compatibility
export const PRESET_LOCATIONS: LocationInfo[] = DEFAULT_PRESET_LOCATIONS;

export const SEARCHED_SPOTS_STORAGE_KEY = 'wind_forecast_searched_spots';

export function isSameLocation(a: LocationInfo, b: LocationInfo): boolean {
  if (a.name.toLowerCase().trim() === b.name.toLowerCase().trim()) {
    return true;
  }
  const latDiff = Math.abs(a.latitude - b.latitude);
  const lonDiff = Math.abs(a.longitude - b.longitude);
  return latDiff < 0.02 && lonDiff < 0.02;
}

export function isLocationActive(preset: LocationInfo, current: LocationInfo): boolean {
  if (preset.name.toLowerCase().trim() === current.name.toLowerCase().trim()) {
    return true;
  }
  return (
    Math.abs(preset.latitude - current.latitude) < 0.005 &&
    Math.abs(preset.longitude - current.longitude) < 0.005
  );
}

export function getCachedSearches(): LocationInfo[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(SEARCHED_SPOTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(item =>
        item &&
        typeof item.name === 'string' &&
        typeof item.latitude === 'number' &&
        typeof item.longitude === 'number' &&
        !isNaN(item.latitude) &&
        !isNaN(item.longitude)
      );
    }
  } catch (err) {
    console.warn('Failed to parse cached searches:', err);
  }
  return [];
}

export function saveCachedSearches(searches: LocationInfo[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SEARCHED_SPOTS_STORAGE_KEY, JSON.stringify(searches));
  } catch (err) {
    console.warn('Failed to save cached searches:', err);
  }
}

export function addSearchedSpot(location: LocationInfo): LocationInfo[] {
  // If it matches any of the default preset spots, don't duplicate
  if (DEFAULT_PRESET_LOCATIONS.some(preset => isSameLocation(preset, location))) {
    return getPopularSpots();
  }

  const existing = getCachedSearches();
  // Filter out if already in cached searches
  const withoutCurrent = existing.filter(item => !isSameLocation(item, location));
  const updated = [...withoutCurrent, location].slice(-20);

  saveCachedSearches(updated);
  return getPopularSpots();
}

export function getPopularSpots(): LocationInfo[] {
  const cached = getCachedSearches();
  const filtered = cached.filter(
    item => !DEFAULT_PRESET_LOCATIONS.some(preset => isSameLocation(preset, item))
  );
  return [...DEFAULT_PRESET_LOCATIONS, ...filtered];
}

export function clearCachedSearches(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(SEARCHED_SPOTS_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear cached searches:', err);
  }
}

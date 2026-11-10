import { LocationInfo } from '../types';
import { getPopularSpots, addSearchedSpot, isLocationActive } from '../utils/presets';
import { searchLocations, requestBrowserLocation } from '../api/geocoding';

export interface LocationBarCallbacks {
  onLocationSelected: (location: LocationInfo) => void;
  onError: (message: string) => void;
}

export function renderLocationBar(
  container: HTMLElement,
  currentLocation: LocationInfo,
  isLoadingLocation: boolean,
  callbacks: LocationBarCallbacks
): void {
  const popularSpots = getPopularSpots();

  container.innerHTML = `
    <section class="location-bar-section" aria-label="Location and Spot Selection">
      <div class="location-primary-row">
        <!-- Geolocation Button -->
        <button
          type="button"
          class="btn btn-primary locate-me-btn"
          id="locate-me-btn"
          ${isLoadingLocation ? 'disabled' : ''}
          aria-label="Share my current location"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="${isLoadingLocation ? 'spin' : ''}">
            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
          </svg>
          <span>${isLoadingLocation ? 'Locating...' : 'Use My Location'}</span>
        </button>

        <!-- Search Input with Dropdown -->
        <div class="search-box-container">
          <label for="location-search-input" class="visually-hidden">Search city, beach, or coordinates</label>
          <div class="input-with-icon">
            <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              id="location-search-input"
              class="location-search-input"
              placeholder="Search any place, beach, or harbor (e.g. Tarifa, Maui, Lisbon)..."
              autocomplete="off"
              role="combobox"
              aria-expanded="false"
              aria-autocomplete="list"
              aria-controls="location-results-dropdown"
            />
            <button type="button" class="search-clear-btn" id="search-clear-btn" aria-label="Clear search" style="display: none;">
              &times;
            </button>
          </div>
          <div id="location-results-dropdown" class="location-dropdown" role="listbox" style="display: none;"></div>
        </div>

        <!-- Current Location Indicator Badge -->
        <div class="current-location-pill" title="Currently showing predictions for this spot">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <span class="spot-name">${currentLocation.name}</span>
          <span class="spot-coords">${currentLocation.latitude.toFixed(2)}°, ${currentLocation.longitude.toFixed(2)}°</span>
        </div>
      </div>

      <!-- Quick Spot Presets -->
      <div class="presets-row" role="region" aria-label="Popular Wind Spots">
        <span class="presets-label">Popular Spots:</span>
        <div class="presets-list">
          ${popularSpots.map((preset, idx) => `
            <button
              type="button"
              class="preset-chip ${isLocationActive(preset, currentLocation) ? 'active' : ''}"
              data-preset-idx="${idx}"
              title="${preset.name}${preset.country ? `, ${preset.country}` : ''}"
            >
              ${preset.name.split(' (')[0]}
            </button>
          `).join('')}
        </div>
      </div>
    </section>
  `;

  // Attach Location button
  const locateBtn = container.querySelector<HTMLButtonElement>('#locate-me-btn');
  locateBtn?.addEventListener('click', async () => {
    try {
      locateBtn.disabled = true;
      locateBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin">
          <circle cx="12" cy="12" r="10"></circle>
        </svg>
        <span>Requesting GPS...</span>
      `;
      const location = await requestBrowserLocation();
      callbacks.onLocationSelected(location);
    } catch (err: unknown) {
      callbacks.onError((err as Error).message);
    } finally {
      locateBtn.disabled = false;
      locateBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
        </svg>
        <span>Use My Location</span>
      `;
    }
  });

  // Attach presets
  container.querySelectorAll<HTMLButtonElement>('[data-preset-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-preset-idx') || '0', 10);
      const preset = popularSpots[idx];
      if (preset) {
        callbacks.onLocationSelected(preset);
      }
    });
  });

  // Search input handling with debounce
  const searchInput = container.querySelector<HTMLInputElement>('#location-search-input');
  const dropdown = container.querySelector<HTMLDivElement>('#location-results-dropdown');
  const clearBtn = container.querySelector<HTMLButtonElement>('#search-clear-btn');
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let currentResults: LocationInfo[] = [];

  const handleSelectLocation = (chosen: LocationInfo) => {
    if (dropdown) {
      dropdown.style.display = 'none';
      dropdown.innerHTML = '';
    }
    if (searchInput) {
      searchInput.value = '';
      searchInput.setAttribute('aria-expanded', 'false');
    }
    if (clearBtn) {
      clearBtn.style.display = 'none';
    }
    currentResults = [];
    addSearchedSpot(chosen);
    callbacks.onLocationSelected(chosen);
  };

  if (searchInput && dropdown && clearBtn) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value;
      clearBtn.style.display = query ? 'inline-block' : 'none';

      if (debounceTimer) clearTimeout(debounceTimer);
      if (query.length < 2) {
        dropdown.style.display = 'none';
        dropdown.innerHTML = '';
        searchInput.setAttribute('aria-expanded', 'false');
        currentResults = [];
        return;
      }

      debounceTimer = setTimeout(async () => {
        dropdown.innerHTML = '<div class="dropdown-item muted">Searching places...</div>';
        dropdown.style.display = 'block';
        searchInput.setAttribute('aria-expanded', 'true');

        const results = await searchLocations(query);
        currentResults = results;
        if (results.length === 0) {
          dropdown.innerHTML = '<div class="dropdown-item muted">No places found. Try another search.</div>';
          return;
        }

        dropdown.innerHTML = results.map((loc, i) => `
          <div class="dropdown-item" role="option" data-idx="${i}" tabindex="0">
            <strong>${loc.name}</strong>
            <span class="dropdown-subtext">${[loc.admin1, loc.country].filter(Boolean).join(', ')} (${loc.latitude.toFixed(2)}°, ${loc.longitude.toFixed(2)}°)</span>
          </div>
        `).join('');

        dropdown.querySelectorAll<HTMLDivElement>('.dropdown-item[data-idx]').forEach(item => {
          const selectItem = () => {
            const idx = parseInt(item.getAttribute('data-idx') || '0', 10);
            const chosen = results[idx];
            if (chosen) {
              handleSelectLocation(chosen);
            }
          };

          item.addEventListener('click', selectItem);
          item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              selectItem();
            }
          });
        });
      }, 300);
    });

    searchInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (currentResults.length > 0) {
          handleSelectLocation(currentResults[0]);
          return;
        }
        const query = searchInput.value.trim();
        if (query.length >= 2) {
          if (debounceTimer) clearTimeout(debounceTimer);
          dropdown.innerHTML = '<div class="dropdown-item muted">Searching places...</div>';
          dropdown.style.display = 'block';
          searchInput.setAttribute('aria-expanded', 'true');
          const results = await searchLocations(query);
          currentResults = results;
          if (results.length > 0) {
            handleSelectLocation(results[0]);
          } else {
            dropdown.innerHTML = '<div class="dropdown-item muted">No places found. Try another search.</div>';
          }
        }
      }
    });

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      dropdown.style.display = 'none';
      searchInput.setAttribute('aria-expanded', 'false');
      currentResults = [];
      searchInput.focus();
    });

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target as Node)) {
        dropdown.style.display = 'none';
        searchInput.setAttribute('aria-expanded', 'false');
      }
    });
  }
}

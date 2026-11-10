import './style.css';
import {
  LocationInfo,
  ForecastResult,
  AppSettings,
  SpeedUnit,
  TempUnit,
  ModelId
} from './types';
import { AVAILABLE_MODELS, fetchWindForecast, generateDemoForecast, clearOpenMeteoCache } from './api/openMeteo';
import { PRESET_LOCATIONS } from './utils/presets';
import { renderHeader } from './components/header';
import { renderLocationBar } from './components/locationBar';
import { TimeScrubber } from './components/timeScrubber';
import { renderCurrentFocusCard } from './components/currentFocusCard';
import { WindChart } from './components/windChart';
import { renderModelSelector } from './components/modelSelector';
import { renderForecastTable } from './components/forecastTable';
import { renderStickyRefreshButton } from './components/stickyRefreshButton';
import { aggregateHour } from './utils/aggregation';

class WindForecastApp {
  private settings: AppSettings;
  private currentLocation: LocationInfo;
  private forecastResult: ForecastResult | null = null;
  private selectedIndex = 0;
  private isLoading = false;
  private lastUpdated: Date | null = null;

  // Components
  private scrubber: TimeScrubber | null = null;
  private chart: WindChart | null = null;

  constructor() {
    this.settings = this.loadSettings();
    this.currentLocation = this.loadInitialLocation();
    this.applyTheme(this.settings.theme);

    this.init();
  }

  private loadSettings(): AppSettings {
    const defaultSettings: AppSettings = {
      speedUnit: 'kmh',
      tempUnit: 'celsius',
      activeModels: AVAILABLE_MODELS.map(m => m.id),
      theme: 'dark',
      autoRefreshMinutes: 30
    };

    const saved = localStorage.getItem('wind_forecast_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...defaultSettings,
          ...parsed
        };
      } catch {
        // fallback
      }
    }
    return defaultSettings;
  }

  private saveSettings(): void {
    localStorage.setItem('wind_forecast_settings', JSON.stringify(this.settings));
  }

  private loadInitialLocation(): LocationInfo {
    // Check URL parameters first (?lat=...&lon=...&name=...)
    const params = new URLSearchParams(window.location.search);
    const lat = params.get('lat');
    const lon = params.get('lon');
    const name = params.get('name');
    if (lat && lon) {
      const parsedLat = parseFloat(lat);
      const parsedLon = parseFloat(lon);
      if (!isNaN(parsedLat) && !isNaN(parsedLon)) {
        return {
          name: name ? decodeURIComponent(name) : `Spot (${parsedLat.toFixed(2)}°, ${parsedLon.toFixed(2)}°)`,
          latitude: parsedLat,
          longitude: parsedLon
        };
      }
    }

    const saved = localStorage.getItem('wind_forecast_last_location');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.name !== 'Guincho Beach (Cascais)') {
          return parsed;
        }
      } catch {
        // fallback
      }
    }
    // Default preset (Ericeira)
    return PRESET_LOCATIONS[0];
  }

  private saveLocation(location: LocationInfo): void {
    localStorage.setItem('wind_forecast_last_location', JSON.stringify(location));
    // Update URL query parameters without reloading
    const url = new URL(window.location.href);
    url.searchParams.set('lat', location.latitude.toFixed(4));
    url.searchParams.set('lon', location.longitude.toFixed(4));
    url.searchParams.set('name', location.name);
    window.history.replaceState({}, '', url.toString());
  }

  private announce(message: string): void {
    const liveRegion = document.getElementById('status-live-region');
    if (liveRegion) {
      liveRegion.textContent = message;
    }
  }

  private applyTheme(theme: 'dark' | 'light' | 'nautical'): void {
    document.body.className = `theme-${theme}`;
  }

  private async init(): Promise<void> {
    this.setupContainers();
    this.saveLocation(this.currentLocation);

    window.addEventListener('popstate', () => {
      const newLoc = this.loadInitialLocation();
      if (
        newLoc.latitude !== this.currentLocation.latitude ||
        newLoc.longitude !== this.currentLocation.longitude ||
        newLoc.name !== this.currentLocation.name
      ) {
        this.currentLocation = newLoc;
        this.loadForecast();
      }
    });

    await this.loadForecast();
  }

  private setupContainers(): void {
    const scrubberContainer = document.getElementById('time-scrubber-container')!;
    this.scrubber = new TimeScrubber(scrubberContainer, {
      onHourSelect: (idx) => this.selectHour(idx)
    });

    const chartContainer = document.getElementById('chart-container')!;
    this.chart = new WindChart(chartContainer, {
      onHourSelect: (idx) => this.selectHour(idx)
    });
  }

  private async loadForecast(options?: { forceRefresh?: boolean }): Promise<void> {
    this.isLoading = true;
    this.renderAlert(null);
    this.renderAll();
    this.announce(`Fetching 48-hour multi-model gust forecast for ${this.currentLocation.name}...`);

    try {
      this.forecastResult = await fetchWindForecast(
        this.currentLocation.latitude,
        this.currentLocation.longitude,
        this.currentLocation.name,
        this.settings.activeModels,
        3,
        options
      );
      this.lastUpdated = this.forecastResult.fetchedAt;
      if (this.forecastResult.isCached) {
        this.announce(`Gust forecast loaded from 15-minute cache for ${this.currentLocation.name}`);
      } else {
        this.announce(`Gust forecast updated for ${this.currentLocation.name}`);
      }
    } catch (err: unknown) {
      const msg = (err as Error).message;
      console.warn('Live API fetch failed, falling back to demo mode:', msg);
      this.renderAlert(`Notice: Could not reach live Open-Meteo API (${msg}). Displaying realistic simulation demo data.`);
      this.forecastResult = generateDemoForecast(
        this.currentLocation.latitude,
        this.currentLocation.longitude,
        this.currentLocation.name
      );
      this.lastUpdated = new Date();
    } finally {
      this.isLoading = false;
      // Default selected hour to current hour or first hour
      if (this.forecastResult) {
        const curIdx = this.forecastResult.hours.findIndex(h => h.isCurrentHour);
        this.selectedIndex = curIdx >= 0 ? curIdx : 0;
      }
      this.renderAll();
    }
  }

  private async handleRefresh(): Promise<void> {
    if (this.isLoading) return;
    clearOpenMeteoCache();
    this.announce(`Cache cleared. Fetching latest forecast from Open-Meteo for ${this.currentLocation.name}...`);
    await this.loadForecast({ forceRefresh: true });
  }

  private selectHour(index: number): void {
    if (!this.forecastResult) return;
    this.selectedIndex = Math.max(0, Math.min(this.forecastResult.hours.length - 1, index));

    const curHour = this.forecastResult.hours[this.selectedIndex];
    if (curHour) {
      this.announce(`Selected ${curHour.dayLabel} at ${curHour.hourLabel}`);
    }

    if (this.scrubber) {
      this.scrubber.setSelectedIndex(this.selectedIndex);
    }
    if (this.chart) {
      this.chart.setSelectedIndex(this.selectedIndex);
    }

    this.renderFocusCard();
    this.renderTable();
  }

  private handleModelsChanged(newModels: ModelId[]): void {
    this.settings.activeModels = newModels;
    this.saveSettings();

    // Re-aggregate locally if we have raw modelValues in each hour
    if (this.forecastResult) {
      this.forecastResult.activeModels = newModels;
      this.forecastResult.hours = this.forecastResult.hours.map(h => {
        return aggregateHour(h.time, h.modelValues, newModels);
      });
    }

    this.renderAll();
  }

  private renderAlert(message: string | null): void {
    const container = document.getElementById('alert-container')!;
    if (!message) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = `
      <div class="alert-banner">
        <span>${message}</span>
        <button type="button" class="btn btn-outline btn-xs" id="dismiss-alert-btn">Dismiss</button>
      </div>
    `;
    container.querySelector('#dismiss-alert-btn')?.addEventListener('click', () => {
      container.innerHTML = '';
    });
  }

  private renderAll(): void {
    this.renderHeader();
    this.renderLocationBar();
    this.renderStickyButton();

    if (!this.forecastResult) return;

    if (this.scrubber) {
      this.scrubber.update(this.forecastResult.hours, this.selectedIndex, this.settings.speedUnit);
    }

    this.renderFocusCard();

    if (this.chart) {
      this.chart.update(
        this.forecastResult.hours,
        this.selectedIndex,
        this.settings.speedUnit,
        this.settings.activeModels
      );
    }

    this.renderModelSelector();
    this.renderTable();
  }

  private renderHeader(): void {
    const container = document.getElementById('header-container')!;
    renderHeader(
      container,
      this.settings,
      this.lastUpdated,
      {
        onSpeedUnitChange: (unit) => {
          this.settings.speedUnit = unit;
          this.saveSettings();
          this.renderAll();
        },
        onTempUnitChange: (unit) => {
          this.settings.tempUnit = unit;
          this.saveSettings();
          this.renderAll();
        },
        onThemeToggle: () => {
          const nextTheme = this.settings.theme === 'dark' ? 'light' : 'dark';
          this.settings.theme = nextTheme;
          this.applyTheme(nextTheme);
          this.saveSettings();
          this.renderAll();
        },
        onRefresh: () => {
          this.handleRefresh();
        }
      },
      this.forecastResult?.isCached ?? false,
      this.isLoading
    );
  }

  private renderStickyButton(): void {
    const container = document.getElementById('sticky-refresh-container');
    if (!container) return;
    renderStickyRefreshButton(
      container,
      this.isLoading,
      this.forecastResult?.isCached ?? false,
      {
        onRefresh: () => {
          this.handleRefresh();
        }
      }
    );
  }

  private renderLocationBar(): void {
    const container = document.getElementById('location-container')!;
    renderLocationBar(container, this.currentLocation, this.isLoading, {
      onLocationSelected: (location) => {
        this.currentLocation = location;
        this.saveLocation(location);
        this.loadForecast();
      },
      onError: (err) => {
        this.renderAlert(err);
      }
    });
  }

  private renderFocusCard(): void {
    const container = document.getElementById('focus-card-container')!;
    if (!this.forecastResult || !this.forecastResult.hours[this.selectedIndex]) {
      container.innerHTML = '';
      return;
    }
    renderCurrentFocusCard(
      container,
      this.forecastResult.hours[this.selectedIndex],
      this.settings.speedUnit,
      this.settings.tempUnit,
      this.settings.activeModels
    );
  }

  private renderModelSelector(): void {
    const container = document.getElementById('model-selector-container')!;
    renderModelSelector(container, this.settings.activeModels, {
      onModelsChanged: (models) => this.handleModelsChanged(models)
    });
  }

  private renderTable(): void {
    const container = document.getElementById('table-container')!;
    if (!this.forecastResult) {
      container.innerHTML = '';
      return;
    }
    renderForecastTable(
      container,
      this.forecastResult.hours,
      this.selectedIndex,
      this.settings.speedUnit,
      this.settings.tempUnit,
      {
        onHourSelect: (idx) => this.selectHour(idx)
      }
    );
  }
}

// Bootstrap app when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new WindForecastApp();
});

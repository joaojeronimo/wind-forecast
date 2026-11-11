import './style.css';
import {
  LocationInfo,
  ForecastResult,
  AppSettings,
  SpeedUnit,
  TempUnit,
  ModelId,
  ViewMode,
  RunEvolutionResult
} from './types';
import {
  AVAILABLE_MODELS,
  MAX_FORECAST_DAYS,
  fetchWindForecast,
  generateDemoForecast,
  trimTrailingEmptyHours,
  clearOpenMeteoCache
} from './api/openMeteo';
import { fetchRunEvolution, generateDemoRunEvolution } from './api/runEvolution';
import { PRESET_LOCATIONS } from './utils/presets';
import { renderHeader } from './components/header';
import { renderLocationBar } from './components/locationBar';
import { TimeScrubber } from './components/timeScrubber';
import { renderCurrentFocusCard } from './components/currentFocusCard';
import { WindChart } from './components/windChart';
import { renderModelSelector } from './components/modelSelector';
import { renderForecastTable } from './components/forecastTable';
import { renderStickyRefreshButton } from './components/stickyRefreshButton';
import { RunEvolutionView } from './components/runEvolution/runEvolutionView';
import { aggregateHour } from './utils/aggregation';
import { findRestoredSelectionIndex } from './utils/selection';

export class WindForecastApp {
  private settings: AppSettings;
  private currentLocation: LocationInfo;
  private currentView: ViewMode = 'ensemble';

  // 48h Ensemble state
  private forecastResult: ForecastResult | null = null;
  private selectedIndex = 0;
  private isLoading = false;
  private lastUpdated: Date | null = null;

  // Extended (up to 16-Day) Ensemble state
  private extendedForecastResult: ForecastResult | null = null;
  private extendedSelectedIndex = 0;
  private isExtendedLoading = false;

  // Run Evolution state
  private evolutionResult: RunEvolutionResult | null = null;
  private evolutionModel: ModelId = 'ecmwf_ifs025';
  private isEvolutionLoading = false;
  private evolutionView: RunEvolutionView | null = null;

  // Components
  private scrubber: TimeScrubber | null = null;
  private chart: WindChart | null = null;
  private extendedScrubber: TimeScrubber | null = null;
  private extendedChart: WindChart | null = null;

  constructor() {
    this.settings = this.loadSettings();
    this.currentLocation = this.loadInitialLocation();
    this.currentView = this.loadInitialView();
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

  private loadInitialView(): ViewMode {
    if (window.location.hash === '#evolution') {
      return 'evolution';
    }
    if (window.location.hash === '#extended') {
      return 'extended';
    }
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    if (viewParam === 'evolution') {
      return 'evolution';
    }
    if (viewParam === 'extended') {
      return 'extended';
    }
    return 'ensemble';
  }

  private loadInitialLocation(): LocationInfo {
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
    return PRESET_LOCATIONS[0];
  }

  private getViewHash(view: ViewMode): string {
    if (view === 'evolution') return '#evolution';
    if (view === 'extended') return '#extended';
    return '#ensemble';
  }

  private saveLocation(location: LocationInfo): void {
    localStorage.setItem('wind_forecast_last_location', JSON.stringify(location));
    const url = new URL(window.location.href);
    url.searchParams.set('lat', location.latitude.toFixed(4));
    url.searchParams.set('lon', location.longitude.toFixed(4));
    url.searchParams.set('name', location.name);
    url.hash = this.getViewHash(this.currentView);
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

  private applyActiveModelsToResult(result: ForecastResult, activeModels: ModelId[], isExtended: boolean): void {
    const sourceHours = result.allHours ?? result.hours;
    const reaggregated = sourceHours.map(h => aggregateHour(h.time, h.modelValues, activeModels));
    result.allHours = reaggregated;
    result.activeModels = activeModels;
    result.hours = isExtended ? trimTrailingEmptyHours(reaggregated) : reaggregated;
  }

  private async init(): Promise<void> {
    this.setupContainers();
    this.setupNavigationTabs();
    this.saveLocation(this.currentLocation);

    window.addEventListener('popstate', () => {
      const newLoc = this.loadInitialLocation();
      const newView = this.loadInitialView();

      if (newView !== this.currentView) {
        this.switchView(newView, false);
      }

      if (
        newLoc.latitude !== this.currentLocation.latitude ||
        newLoc.longitude !== this.currentLocation.longitude ||
        newLoc.name !== this.currentLocation.name
      ) {
        this.currentLocation = newLoc;
        this.loadForecast();
        if (this.currentView === 'extended' || this.extendedForecastResult) {
          this.loadExtendedForecast();
        }
        if (this.currentView === 'evolution' || this.evolutionResult) {
          this.loadRunEvolution();
        }
      }
    });

    // Initial view sync
    this.updateTabUI();

    // Start fetching data
    await this.loadForecast();

    if (this.currentView === 'extended') {
      await this.loadExtendedForecast();
    } else if (this.currentView === 'evolution') {
      await this.loadRunEvolution();
    }
  }

  private setupContainers(): void {
    const scrubberContainer = document.getElementById('time-scrubber-container')!;
    this.scrubber = new TimeScrubber(scrubberContainer, {
      onHourSelect: (idx) => this.selectHour(idx, false)
    });

    const chartContainer = document.getElementById('chart-container')!;
    this.chart = new WindChart(chartContainer, {
      onHourSelect: (idx) => this.selectHour(idx, false)
    });

    const extScrubberContainer = document.getElementById('extended-time-scrubber-container');
    if (extScrubberContainer) {
      this.extendedScrubber = new TimeScrubber(
        extScrubberContainer,
        {
          onHourSelect: (idx) => this.selectHour(idx, true)
        },
        { idPrefix: 'extended-', isExtended: true }
      );
    }

    const extChartContainer = document.getElementById('extended-chart-container');
    if (extChartContainer) {
      this.extendedChart = new WindChart(
        extChartContainer,
        {
          onHourSelect: (idx) => this.selectHour(idx, true)
        },
        { idPrefix: 'extended-', isExtended: true }
      );
    }

    const evolutionContainer = document.getElementById('evolution-container')!;
    this.evolutionView = new RunEvolutionView(evolutionContainer, {
      onModelChange: (model) => {
        this.evolutionModel = model;
        this.loadRunEvolution();
      },
      onRefresh: () => {
        this.handleRefresh();
      }
    });
  }

  private getTabViewMode(tabId: string): ViewMode {
    if (tabId === 'tab-evolution') return 'evolution';
    if (tabId === 'tab-extended') return 'extended';
    return 'ensemble';
  }

  /**
   * Accessible Tab Navigation per Modern Web Guidance
   */
  private setupNavigationTabs(): void {
    const tabEnsemble = document.getElementById('tab-ensemble');
    const tabExtended = document.getElementById('tab-extended');
    const tabEvolution = document.getElementById('tab-evolution');

    const tabs = [tabEnsemble, tabExtended, tabEvolution].filter(Boolean) as HTMLElement[];

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => {
        const targetView = this.getTabViewMode(tab.id);
        this.switchView(targetView);
      });

      // Keyboard navigation: Left/Right arrow keys
      tab.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          const nextTab = tabs[(index + 1) % tabs.length];
          nextTab.focus();
          this.switchView(this.getTabViewMode(nextTab.id));
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          const prevTab = tabs[(index - 1 + tabs.length) % tabs.length];
          prevTab.focus();
          this.switchView(this.getTabViewMode(prevTab.id));
        }
      });
    });
  }

  public switchView(view: ViewMode, updateHistory = true): void {
    if (this.currentView === view && updateHistory) return;

    // Pause any active playback loop when leaving a tab
    this.scrubber?.stopPlay();
    this.extendedScrubber?.stopPlay();

    this.currentView = view;
    this.updateTabUI();

    if (updateHistory) {
      const url = new URL(window.location.href);
      url.hash = this.getViewHash(view);
      window.history.pushState({}, '', url.toString());
    }

    if (view === 'evolution') {
      document.title = `Run Evolution • ${this.currentLocation.name} | GustForecast`;
      this.announce('Switched to Model Run Evolution Tracker view');
      if (!this.evolutionResult) {
        this.loadRunEvolution();
      } else {
        this.renderAll();
      }
    } else if (view === 'extended') {
      document.title = `Extended 16-Day Ensemble • ${this.currentLocation.name} | GustForecast`;
      this.announce('Switched to Extended 16-Day Ensemble Forecast view');
      if (!this.extendedForecastResult) {
        this.loadExtendedForecast();
      } else {
        this.renderAll();
      }
    } else {
      document.title = `48h Ensemble • ${this.currentLocation.name} | GustForecast`;
      this.announce('Switched to 48-Hour Ensemble Forecast view');
      this.renderAll();
    }
  }

  private updateTabUI(): void {
    const tabEnsemble = document.getElementById('tab-ensemble');
    const tabExtended = document.getElementById('tab-extended');
    const tabEvolution = document.getElementById('tab-evolution');
    const panelEnsemble = document.getElementById('panel-ensemble');
    const panelExtended = document.getElementById('panel-extended');
    const panelEvolution = document.getElementById('panel-evolution');

    const isEnsemble = this.currentView === 'ensemble';
    const isExtended = this.currentView === 'extended';
    const isEvolution = this.currentView === 'evolution';

    tabEnsemble?.setAttribute('aria-selected', isEnsemble ? 'true' : 'false');
    tabExtended?.setAttribute('aria-selected', isExtended ? 'true' : 'false');
    tabEvolution?.setAttribute('aria-selected', isEvolution ? 'true' : 'false');

    const activeTab = isEvolution ? tabEvolution : isExtended ? tabExtended : tabEnsemble;
    (activeTab as any)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', container: 'nearest' });

    if (isEnsemble) {
      panelEnsemble?.removeAttribute('hidden');
    } else {
      panelEnsemble?.setAttribute('hidden', '');
    }

    if (isExtended) {
      panelExtended?.removeAttribute('hidden');
    } else {
      panelExtended?.setAttribute('hidden', '');
    }

    if (isEvolution) {
      panelEvolution?.removeAttribute('hidden');
    } else {
      panelEvolution?.setAttribute('hidden', '');
    }
  }

  private async loadForecast(options?: { forceRefresh?: boolean; resetSelection?: boolean }): Promise<void> {
    const prevSelectedHour = options?.resetSelection ? undefined : this.forecastResult?.hours[this.selectedIndex];
    const prevSelectedTime = prevSelectedHour?.time;
    const prevSelectedTimestamp = prevSelectedHour?.date.getTime();

    this.isLoading = true;
    this.renderAlert(null);
    this.renderAll();
    this.announce(`Fetching 48-hour multi-model gust forecast for ${this.currentLocation.name}...`);

    try {
      const allModelIds = AVAILABLE_MODELS.map(m => m.id);
      const result = await fetchWindForecast(
        this.currentLocation.latitude,
        this.currentLocation.longitude,
        this.currentLocation.name,
        allModelIds,
        3,
        options
      );
      this.applyActiveModelsToResult(result, this.settings.activeModels, false);
      this.forecastResult = result;
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
        this.currentLocation.name,
        48,
        this.settings.activeModels
      );
      this.lastUpdated = new Date();
    } finally {
      this.isLoading = false;
      if (this.forecastResult) {
        this.selectedIndex = findRestoredSelectionIndex(
          this.forecastResult.hours,
          prevSelectedTime,
          prevSelectedTimestamp
        );
      }
      this.renderAll();
    }
  }

  public async loadExtendedForecast(options?: { forceRefresh?: boolean; resetSelection?: boolean }): Promise<void> {
    const prevSelectedHour = options?.resetSelection
      ? undefined
      : (this.extendedForecastResult?.hours[this.extendedSelectedIndex] ?? this.forecastResult?.hours[this.selectedIndex]);
    const prevSelectedTime = prevSelectedHour?.time;
    const prevSelectedTimestamp = prevSelectedHour?.date.getTime();

    this.isExtendedLoading = true;
    this.renderAlert(null);
    this.renderAll();
    this.announce(`Fetching extended ${MAX_FORECAST_DAYS}-day multi-model gust forecast for ${this.currentLocation.name}...`);

    try {
      const allModelIds = AVAILABLE_MODELS.map(m => m.id);
      const result = await fetchWindForecast(
        this.currentLocation.latitude,
        this.currentLocation.longitude,
        this.currentLocation.name,
        allModelIds,
        MAX_FORECAST_DAYS,
        options
      );
      this.applyActiveModelsToResult(result, this.settings.activeModels, true);
      this.extendedForecastResult = result;
      this.lastUpdated = this.extendedForecastResult.fetchedAt;

      const daysSpan = Math.max(1, Math.ceil(this.extendedForecastResult.hours.length / 24));
      const badgeEl = document.getElementById('extended-tab-badge');
      if (badgeEl) {
        badgeEl.textContent = `${daysSpan}-Day`;
      }

      if (this.extendedForecastResult.isCached) {
        this.announce(`Extended ${daysSpan}-day gust forecast loaded from cache for ${this.currentLocation.name}`);
      } else {
        this.announce(`Extended ${daysSpan}-day gust forecast updated for ${this.currentLocation.name}`);
      }
    } catch (err: unknown) {
      const msg = (err as Error).message;
      console.warn('Live extended API fetch failed, falling back to demo mode:', msg);
      this.renderAlert(`Notice: Could not reach live Open-Meteo API (${msg}). Displaying realistic extended simulation demo data.`);
      this.extendedForecastResult = generateDemoForecast(
        this.currentLocation.latitude,
        this.currentLocation.longitude,
        this.currentLocation.name,
        MAX_FORECAST_DAYS * 24,
        this.settings.activeModels
      );
      this.lastUpdated = new Date();
    } finally {
      this.isExtendedLoading = false;
      if (this.extendedForecastResult) {
        this.extendedSelectedIndex = findRestoredSelectionIndex(
          this.extendedForecastResult.hours,
          prevSelectedTime,
          prevSelectedTimestamp
        );
      }
      this.renderAll();
    }
  }

  public async loadRunEvolution(options?: { forceRefresh?: boolean }): Promise<void> {
    this.isEvolutionLoading = true;
    this.evolutionView?.update(
      this.evolutionResult,
      this.evolutionModel,
      this.settings.speedUnit,
      true
    );
    this.announce(`Fetching consecutive runs for ${this.evolutionModel} at ${this.currentLocation.name}...`);

    try {
      this.evolutionResult = await fetchRunEvolution(
        this.currentLocation.latitude,
        this.currentLocation.longitude,
        this.currentLocation.name,
        this.evolutionModel,
        5,
        options
      );
      this.announce(`Model runs loaded for ${this.evolutionResult.modelName}`);
    } catch (err: unknown) {
      const msg = (err as Error).message;
      console.warn('Single-runs API fetch failed, falling back to demo runs:', msg);
      this.renderAlert(`Notice: Live model run archive fetch was unavailable (${msg}). Displaying simulated run evolution.`);
      this.evolutionResult = generateDemoRunEvolution(
        this.currentLocation.latitude,
        this.currentLocation.longitude,
        this.currentLocation.name,
        this.evolutionModel,
        5
      );
    } finally {
      this.isEvolutionLoading = false;
      this.evolutionView?.update(
        this.evolutionResult,
        this.evolutionModel,
        this.settings.speedUnit,
        false
      );
    }
  }

  private async handleRefresh(): Promise<void> {
    if (this.isLoading || this.isExtendedLoading || this.isEvolutionLoading) return;
    clearOpenMeteoCache();
    this.announce(`Cache cleared. Fetching latest forecasts from Open-Meteo for ${this.currentLocation.name}...`);

    if (this.currentView === 'evolution') {
      await this.loadRunEvolution({ forceRefresh: true });
    } else if (this.currentView === 'extended') {
      await this.loadExtendedForecast({ forceRefresh: true });
    } else {
      await this.loadForecast({ forceRefresh: true });
    }
  }

  private selectHour(index: number, isExtended = false): void {
    const targetResult = isExtended ? this.extendedForecastResult : this.forecastResult;
    if (!targetResult || targetResult.hours.length === 0) return;

    const clamped = Math.max(0, Math.min(targetResult.hours.length - 1, index));
    if (isExtended) {
      this.extendedSelectedIndex = clamped;
    } else {
      this.selectedIndex = clamped;
    }

    const curHour = targetResult.hours[clamped];
    if (curHour) {
      this.announce(`Selected ${curHour.dayLabel} at ${curHour.hourLabel}`);
    }

    if (isExtended) {
      this.extendedScrubber?.setSelectedIndex(clamped);
      this.extendedChart?.setSelectedIndex(clamped);
      this.renderExtendedFocusCard();
      this.renderExtendedTable();
    } else {
      this.scrubber?.setSelectedIndex(clamped);
      this.chart?.setSelectedIndex(clamped);
      this.renderFocusCard();
      this.renderTable();
    }
  }

  private handleModelsChanged(newModels: ModelId[]): void {
    this.settings.activeModels = newModels;
    this.saveSettings();

    if (this.forecastResult) {
      this.applyActiveModelsToResult(this.forecastResult, newModels, false);
      this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.forecastResult.hours.length - 1));
    }

    if (this.extendedForecastResult) {
      const prevTime = this.extendedForecastResult.hours[this.extendedSelectedIndex]?.time;
      const prevTs = this.extendedForecastResult.hours[this.extendedSelectedIndex]?.date.getTime();
      this.applyActiveModelsToResult(this.extendedForecastResult, newModels, true);
      this.extendedSelectedIndex = findRestoredSelectionIndex(
        this.extendedForecastResult.hours,
        prevTime,
        prevTs
      );
      const daysSpan = Math.max(1, Math.ceil(this.extendedForecastResult.hours.length / 24));
      const badgeEl = document.getElementById('extended-tab-badge');
      if (badgeEl) {
        badgeEl.textContent = `${daysSpan}-Day`;
      }
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

  private getActiveStatusFlags(): { isCached: boolean; isLoading: boolean } {
    if (this.currentView === 'evolution') {
      return {
        isCached: this.evolutionResult?.isCached ?? false,
        isLoading: this.isEvolutionLoading
      };
    }
    if (this.currentView === 'extended') {
      return {
        isCached: this.extendedForecastResult?.isCached ?? false,
        isLoading: this.isExtendedLoading
      };
    }
    return {
      isCached: this.forecastResult?.isCached ?? false,
      isLoading: this.isLoading
    };
  }

  private renderAll(): void {
    this.renderHeader();
    this.renderLocationBar();
    this.renderStickyButton();

    if (this.currentView === 'evolution') {
      if (this.evolutionResult) {
        this.evolutionView?.update(
          this.evolutionResult,
          this.evolutionModel,
          this.settings.speedUnit,
          this.isEvolutionLoading
        );
      }
      return;
    }

    if (this.currentView === 'extended') {
      if (!this.extendedForecastResult) return;

      this.extendedScrubber?.update(
        this.extendedForecastResult.hours,
        this.extendedSelectedIndex,
        this.settings.speedUnit
      );
      this.renderExtendedFocusCard();
      this.extendedChart?.update(
        this.extendedForecastResult.hours,
        this.extendedSelectedIndex,
        this.settings.speedUnit,
        this.settings.activeModels
      );
      this.renderExtendedModelSelector();
      this.renderExtendedTable();
      return;
    }

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
    const { isCached, isLoading } = this.getActiveStatusFlags();

    renderHeader(
      container,
      this.settings,
      this.lastUpdated,
      {
        onSpeedUnitChange: (unit) => {
          this.settings.speedUnit = unit;
          this.saveSettings();
          this.renderAll();
          if (this.evolutionResult) {
            this.evolutionView?.update(
              this.evolutionResult,
              this.evolutionModel,
              unit,
              this.isEvolutionLoading
            );
          }
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
      isCached,
      isLoading
    );
  }

  private renderStickyButton(): void {
    const container = document.getElementById('sticky-refresh-container');
    if (!container) return;
    const { isCached, isLoading } = this.getActiveStatusFlags();

    renderStickyRefreshButton(
      container,
      isLoading,
      isCached,
      {
        onRefresh: () => {
          this.handleRefresh();
        }
      }
    );
  }

  private renderLocationBar(): void {
    const container = document.getElementById('location-container')!;
    const { isLoading } = this.getActiveStatusFlags();

    renderLocationBar(container, this.currentLocation, isLoading, {
      onLocationSelected: (location) => {
        this.currentLocation = location;
        this.saveLocation(location);
        this.loadForecast();
        if (this.currentView === 'extended' || this.extendedForecastResult) {
          this.loadExtendedForecast();
        }
        if (this.currentView === 'evolution' || this.evolutionResult) {
          this.loadRunEvolution();
        }
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

  private renderExtendedFocusCard(): void {
    const container = document.getElementById('extended-focus-card-container');
    if (!container) return;
    if (!this.extendedForecastResult || !this.extendedForecastResult.hours[this.extendedSelectedIndex]) {
      container.innerHTML = '';
      return;
    }
    renderCurrentFocusCard(
      container,
      this.extendedForecastResult.hours[this.extendedSelectedIndex],
      this.settings.speedUnit,
      this.settings.tempUnit,
      this.settings.activeModels,
      { idPrefix: 'extended-', isExtended: true }
    );
  }

  private renderModelSelector(): void {
    const container = document.getElementById('model-selector-container')!;
    renderModelSelector(container, this.settings.activeModels, {
      onModelsChanged: (models) => this.handleModelsChanged(models)
    });
  }

  private renderExtendedModelSelector(): void {
    const container = document.getElementById('extended-model-selector-container');
    if (!container) return;
    renderModelSelector(
      container,
      this.settings.activeModels,
      {
        onModelsChanged: (models) => this.handleModelsChanged(models)
      },
      { idPrefix: 'extended-', isExtended: true }
    );
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
        onHourSelect: (idx) => this.selectHour(idx, false)
      }
    );
  }

  private renderExtendedTable(): void {
    const container = document.getElementById('extended-table-container');
    if (!container) return;
    if (!this.extendedForecastResult) {
      container.innerHTML = '';
      return;
    }
    renderForecastTable(
      container,
      this.extendedForecastResult.hours,
      this.extendedSelectedIndex,
      this.settings.speedUnit,
      this.settings.tempUnit,
      {
        onHourSelect: (idx) => this.selectHour(idx, true)
      },
      { idPrefix: 'extended-', isExtended: true }
    );
  }
}

// Bootstrap app when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new WindForecastApp();
});

import { AppSettings, SpeedUnit, TempUnit } from '../types';

export interface HeaderCallbacks {
  onSpeedUnitChange: (unit: SpeedUnit) => void;
  onTempUnitChange: (unit: TempUnit) => void;
  onThemeToggle: () => void;
  onRefresh: () => void;
}

export function renderHeader(
  container: HTMLElement,
  settings: AppSettings,
  lastUpdated: Date | null,
  callbacks: HeaderCallbacks,
  isCached = false,
  isLoading = false
): void {
  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--';

  container.innerHTML = `
    <header class="app-header" role="banner">
      <div class="header-left">
        <div class="brand">
          <svg class="brand-icon" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"></path>
            <path d="M9.6 4.6A2 2 0 1 1 11 8H2"></path>
            <path d="M12.6 19.4A2 2 0 1 0 14 16H2"></path>
          </svg>
          <div class="brand-text">
            <h1 class="brand-title">GustForecast</h1>
            <span class="brand-subtitle">48h Multi-Model Wind Gusts Ensemble • Open-Meteo</span>
          </div>
        </div>
      </div>

      <div class="header-controls">
        <!-- Gust Speed Unit Toggle -->
        <fieldset class="unit-group" aria-label="Gust speed unit">
          <legend class="visually-hidden">Gust speed unit</legend>
          <button type="button" class="unit-btn ${settings.speedUnit === 'knots' ? 'active' : ''}" data-speed="knots">kts</button>
          <button type="button" class="unit-btn ${settings.speedUnit === 'kmh' ? 'active' : ''}" data-speed="kmh">km/h</button>
          <button type="button" class="unit-btn ${settings.speedUnit === 'ms' ? 'active' : ''}" data-speed="ms">m/s</button>
          <button type="button" class="unit-btn ${settings.speedUnit === 'mph' ? 'active' : ''}" data-speed="mph">mph</button>
        </fieldset>

        <!-- Temp Unit Toggle -->
        <fieldset class="unit-group" aria-label="Temperature unit">
          <legend class="visually-hidden">Temperature unit</legend>
          <button type="button" class="unit-btn ${settings.tempUnit === 'celsius' ? 'active' : ''}" data-temp="celsius">°C</button>
          <button type="button" class="unit-btn ${settings.tempUnit === 'fahrenheit' ? 'active' : ''}" data-temp="fahrenheit">°F</button>
        </fieldset>

        <!-- Refresh Button -->
        <button type="button" class="icon-btn refresh-btn ${isLoading ? 'loading' : ''}" id="refresh-data-btn" title="Refresh gust forecast (clears cache)" aria-label="Refresh gust forecast (updated ${timeStr}${isCached ? ', cached' : ''})" ${isLoading ? 'disabled' : ''}>
          <svg class="${isLoading ? 'spin' : ''}" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
          <span class="refresh-time" aria-hidden="true">${timeStr}${isCached ? ' (cached)' : ''}</span>
        </button>

        <!-- Theme Toggle -->
        <button type="button" class="icon-btn theme-btn" id="theme-toggle-btn" title="Toggle color theme" aria-label="Toggle dark and light theme">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
        </button>
      </div>
    </header>
  `;

  container.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(btn => {
    btn.addEventListener('click', () => {
      const unit = btn.getAttribute('data-speed') as SpeedUnit;
      callbacks.onSpeedUnitChange(unit);
    });
  });

  container.querySelectorAll<HTMLButtonElement>('[data-temp]').forEach(btn => {
    btn.addEventListener('click', () => {
      const unit = btn.getAttribute('data-temp') as TempUnit;
      callbacks.onTempUnitChange(unit);
    });
  });

  container.querySelector('#refresh-data-btn')?.addEventListener('click', () => {
    callbacks.onRefresh();
  });

  container.querySelector('#theme-toggle-btn')?.addEventListener('click', () => {
    callbacks.onThemeToggle();
  });
}

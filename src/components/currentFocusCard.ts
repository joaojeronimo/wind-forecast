import { AggregatedHour, SpeedUnit, TempUnit, ModelId } from '../types';
import { AVAILABLE_MODELS, MODEL_MAX_HORIZON_HOURS } from '../api/openMeteo';
import { formatSpeed, formatTemp, convertSpeed, getSpeedUnitLabel } from '../utils/units';

export interface FocusCardOptions {
  idPrefix?: string;
  isExtended?: boolean;
}

export function renderCurrentFocusCard(
  container: HTMLElement,
  hour: AggregatedHour,
  speedUnit: SpeedUnit,
  tempUnit: TempUnit,
  activeModelIds: ModelId[],
  options?: FocusCardOptions
): void {
  const p = options?.idPrefix ?? '';
  const isExtended = options?.isExtended ?? false;
  const modelLookup = new Map(AVAILABLE_MODELS.map(m => [m.id, m]));

  const peakGustFormatted = formatSpeed(hour.gustMax, speedUnit);
  const meanGustFormatted = formatSpeed(hour.gustMean, speedUnit);
  const minGustFormatted = formatSpeed(hour.gustMin, speedUnit);
  const tempFormatted = formatTemp(hour.tempMean, tempUnit);

  const consensusClass =
    hour.consensus === 'high' ? 'badge-consensus-high' :
    hour.consensus === 'moderate' ? 'badge-consensus-moderate' : 'badge-consensus-divergent';

  const consensusText =
    hour.consensus === 'high' ? 'High Agreement' :
    hour.consensus === 'moderate' ? 'Moderate Spread' : 'Divergent Gusts';

  const arrowRotation = (hour.directionMean + 180) % 360;
  const sublabelText = hour.reportingModelsCount < activeModelIds.length
    ? `${hour.reportingModelsCount} of ${activeModelIds.length} active models reach this forecast horizon`
    : `${hour.reportingModelsCount} models reporting gust forecasts`;

  container.innerHTML = `
    <article class="focus-card" aria-labelledby="${p}focus-card-title">
      <div class="focus-card-top-row">
        <div class="focus-time-header">
          <h2 id="${p}focus-card-title" class="focus-date">${hour.dayLabel} • ${hour.hourLabel}</h2>
          <span class="focus-sublabel">${sublabelText}</span>
        </div>

        <div class="focus-badges">
          <span class="badge ${consensusClass}" title="Gust standard deviation: ±${convertSpeed(hour.gustStdDev, speedUnit).toFixed(1)} ${getSpeedUnitLabel(speedUnit)}">
            ${consensusText} (±${convertSpeed(hour.gustStdDev, speedUnit).toFixed(1)})
          </span>
          <span class="badge badge-beaufort" style="background-color: ${hour.beaufort.color}22; color: ${hour.beaufort.color}; border: 1px solid ${hour.beaufort.color}44">
            Bft ${hour.beaufort.number}: ${hour.beaufort.label} Gusts
          </span>
        </div>
      </div>

      <div class="focus-main-grid">
        <!-- Wind Compass / Direction Box -->
        <div class="focus-compass-box" title="Gusts blowing FROM ${hour.directionMean.toFixed(0)}° (${hour.cardinal})">
          <div class="compass-dial" aria-hidden="true">
            <span class="compass-marker marker-n">N</span>
            <span class="compass-marker marker-e">E</span>
            <span class="compass-marker marker-s">S</span>
            <span class="compass-marker marker-w">W</span>
            <div class="compass-arrow-container" style="transform: rotate(${arrowRotation}deg);">
              <svg class="compass-arrow" viewBox="0 0 24 24" width="38" height="38" fill="currentColor" aria-hidden="true">
                <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"></path>
              </svg>
            </div>
          </div>
          <div class="compass-label-group">
            <span class="compass-cardinal">${hour.cardinal}</span>
            <span class="compass-degrees">${hour.directionMean.toFixed(0)}°</span>
            <span class="compass-spread">spread: ±${hour.directionSpread.toFixed(0)}°</span>
          </div>
        </div>

        <!-- Gust Speed Box -->
        <div class="focus-speed-box">
          <div class="speed-main-display">
            <span class="speed-number">${convertSpeed(hour.gustMax, speedUnit).toFixed(1)}</span>
            <div class="speed-label-stack">
              <span class="speed-unit-label">${speedUnit === 'knots' ? 'knots' : getSpeedUnitLabel(speedUnit)}</span>
              <span class="gust-hero-tag">PEAK GUST</span>
            </div>
          </div>
          <div class="speed-details-row">
            <div class="stat-pill gust-pill">
              <span class="stat-pill-label">Consensus Mean:</span>
              <span class="stat-pill-val">${meanGustFormatted}</span>
            </div>
            <div class="stat-pill">
              <span class="stat-pill-label">Model Range:</span>
              <span class="stat-pill-val">${minGustFormatted} – ${peakGustFormatted}</span>
            </div>
            <div class="stat-pill temp-pill">
              <span class="stat-pill-label">Temp:</span>
              <span class="stat-pill-val">${tempFormatted}</span>
            </div>
          </div>
          <p class="beaufort-condition-desc">${hour.beaufort.description}</p>
        </div>
      </div>

      <!-- Individual Model Gust Comparison for this Hour -->
      <div class="model-breakdown-section">
        <h3 class="model-breakdown-title">Model Gust Predictions for this Hour</h3>
        <div class="model-chips-grid">
          ${activeModelIds.map(id => {
            const model = modelLookup.get(id);
            if (!model) return '';
            const val = hour.modelValues[id];
            if (!val) {
              if (!isExtended) return '';
              const maxDays = Math.round((MODEL_MAX_HORIZON_HOURS[id] / 24) * 10) / 10;
              return `
                <div class="model-chip model-chip-out-of-range" style="border-left: 3px solid ${model.color}55;" title="${model.name} forecast horizon is up to ~${maxDays} days (${MODEL_MAX_HORIZON_HOURS[id]}h)">
                  <div class="model-chip-header">
                    <span class="model-chip-name" style="color: ${model.color};">${model.name}</span>
                    <span class="model-chip-agency">${model.agency}</span>
                  </div>
                  <div class="model-chip-body">
                    <div class="model-chip-speed model-chip-na">—</div>
                  </div>
                  <div class="model-chip-gust">Max range ~${maxDays}d (${MODEL_MAX_HORIZON_HOURS[id]}h)</div>
                </div>
              `;
            }
            const mArrowRot = (val.direction + 180) % 360;
            return `
              <div class="model-chip" style="border-left: 3px solid ${model.color};">
                <div class="model-chip-header">
                  <span class="model-chip-name" style="color: ${model.color};">${model.name}</span>
                  <span class="model-chip-agency">${model.agency}</span>
                </div>
                <div class="model-chip-body">
                  <div class="model-chip-speed">
                    ${formatSpeed(val.gust, speedUnit)}
                  </div>
                  <div class="model-chip-dir" title="${val.direction}°">
                    <svg class="chip-arrow" style="transform: rotate(${mArrowRot}deg);" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                      <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"></path>
                    </svg>
                    <span>${val.direction}°</span>
                  </div>
                </div>
                <div class="model-chip-gust">Gust Forecast</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </article>
  `;
}

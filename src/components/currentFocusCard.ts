import { AggregatedHour, SpeedUnit, TempUnit, ModelId } from '../types';
import { AVAILABLE_MODELS } from '../api/openMeteo';
import { formatSpeed, formatTemp, convertSpeed } from '../utils/units';

export function renderCurrentFocusCard(
  container: HTMLElement,
  hour: AggregatedHour,
  speedUnit: SpeedUnit,
  tempUnit: TempUnit,
  activeModelIds: ModelId[]
): void {
  const modelLookup = new Map(AVAILABLE_MODELS.map(m => [m.id, m]));

  const speedFormatted = formatSpeed(hour.speedMean, speedUnit);
  const gustFormatted = formatSpeed(hour.gustMax, speedUnit);
  const tempFormatted = formatTemp(hour.tempMean, tempUnit);
  const minSpeedFormatted = formatSpeed(hour.speedMin, speedUnit);
  const maxSpeedFormatted = formatSpeed(hour.speedMax, speedUnit);

  const consensusClass =
    hour.consensus === 'high' ? 'badge-consensus-high' :
    hour.consensus === 'moderate' ? 'badge-consensus-moderate' : 'badge-consensus-divergent';

  const consensusText =
    hour.consensus === 'high' ? 'High Agreement' :
    hour.consensus === 'moderate' ? 'Moderate Spread' : 'Divergent Forecast';

  // In meteorology, wind direction is where the wind is coming FROM.
  // The arrow represents airflow, so it points in the direction wind is blowing TOWARDS (direction + 180).
  const arrowRotation = (hour.directionMean + 180) % 360;

  container.innerHTML = `
    <article class="focus-card" aria-labelledby="focus-card-title">
      <div class="focus-card-top-row">
        <div class="focus-time-header">
          <h2 id="focus-card-title" class="focus-date">${hour.dayLabel} • ${hour.hourLabel}</h2>
          <span class="focus-sublabel">${hour.reportingModelsCount} models reporting</span>
        </div>

        <div class="focus-badges">
          <span class="badge ${consensusClass}" title="Model standard deviation: ±${convertSpeed(hour.speedStdDev, speedUnit).toFixed(1)} ${speedUnit}">
            ${consensusText} (±${convertSpeed(hour.speedStdDev, speedUnit).toFixed(1)})
          </span>
          <span class="badge badge-beaufort" style="background-color: ${hour.beaufort.color}22; color: ${hour.beaufort.color}; border: 1px solid ${hour.beaufort.color}44">
            Bft ${hour.beaufort.number}: ${hour.beaufort.label}
          </span>
        </div>
      </div>

      <div class="focus-main-grid">
        <!-- Wind Compass / Direction Box -->
        <div class="focus-compass-box" title="Wind blowing FROM ${hour.directionMean.toFixed(0)}° (${hour.cardinal})">
          <div class="compass-dial" aria-hidden="true">
            <span class="compass-marker marker-n">N</span>
            <span class="compass-marker marker-e">E</span>
            <span class="compass-marker marker-s">S</span>
            <span class="compass-marker marker-w">W</span>
            <div class="compass-arrow-container" style="transform: rotate(${arrowRotation}deg);">
              <svg class="compass-arrow" viewBox="0 0 24 24" width="38" height="38" fill="currentColor">
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

        <!-- Speed and Gusts Box -->
        <div class="focus-speed-box">
          <div class="speed-main-display">
            <span class="speed-number">${convertSpeed(hour.speedMean, speedUnit).toFixed(1)}</span>
            <span class="speed-unit-label">${speedUnit === 'knots' ? 'knots' : speedUnit}</span>
          </div>
          <div class="speed-details-row">
            <div class="stat-pill">
              <span class="stat-pill-label">Range:</span>
              <span class="stat-pill-val">${minSpeedFormatted} - ${maxSpeedFormatted}</span>
            </div>
            <div class="stat-pill gust-pill">
              <span class="stat-pill-label">Peak Gusts:</span>
              <span class="stat-pill-val">${gustFormatted}</span>
            </div>
            <div class="stat-pill temp-pill">
              <span class="stat-pill-label">Temperature:</span>
              <span class="stat-pill-val">${tempFormatted}</span>
            </div>
          </div>
          <p class="beaufort-condition-desc">${hour.beaufort.description}</p>
        </div>
      </div>

      <!-- Individual Model Comparison Table for this Hour -->
      <div class="model-breakdown-section">
        <h3 class="model-breakdown-title">Model Predictions for this Hour</h3>
        <div class="model-chips-grid">
          ${activeModelIds.map(id => {
            const model = modelLookup.get(id);
            const val = hour.modelValues[id];
            if (!model || !val) return '';
            const mArrowRot = (val.direction + 180) % 360;
            return `
              <div class="model-chip" style="border-left: 3px solid ${model.color};">
                <div class="model-chip-header">
                  <span class="model-chip-name" style="color: ${model.color};">${model.name}</span>
                  <span class="model-chip-agency">${model.agency}</span>
                </div>
                <div class="model-chip-body">
                  <div class="model-chip-speed">
                    ${formatSpeed(val.speed, speedUnit)}
                  </div>
                  <div class="model-chip-dir" title="${val.direction}°">
                    <svg class="chip-arrow" style="transform: rotate(${mArrowRot}deg);" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                      <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"></path>
                    </svg>
                    <span>${val.direction}°</span>
                  </div>
                </div>
                ${val.gust ? `<div class="model-chip-gust">Gusts: ${formatSpeed(val.gust, speedUnit)}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </article>
  `;
}

import { AggregatedHour, SpeedUnit, TempUnit } from '../types';
import { formatSpeed, formatTemp, convertSpeed } from '../utils/units';

export interface ForecastTableCallbacks {
  onHourSelect: (index: number) => void;
}

export function renderForecastTable(
  container: HTMLElement,
  hours: AggregatedHour[],
  selectedIndex: number,
  speedUnit: SpeedUnit,
  tempUnit: TempUnit,
  callbacks: ForecastTableCallbacks
): void {
  if (hours.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <section class="table-section" aria-labelledby="forecast-table-caption">
      <div class="table-header-bar">
        <h3 id="forecast-table-caption" class="table-caption-title">48-Hour Detailed Hourly Gust Forecast Matrix</h3>
        <div class="table-actions">
          <button type="button" class="btn btn-outline btn-sm" id="table-scroll-selected-btn">
            Scroll to Selected
          </button>
        </div>
      </div>

      <div
        tabindex="0"
        role="region"
        aria-labelledby="forecast-table-caption"
        class="table-wrapper"
        id="forecast-table-wrapper"
      >
        <table class="forecast-data-table">
          <thead>
            <tr>
              <th scope="col" class="col-sticky-time">Day / Time</th>
              <th scope="col">Peak Gust (Max)</th>
              <th scope="col">Consensus Gust (Mean)</th>
              <th scope="col">Model Gust Spread (Min – Max)</th>
              <th scope="col">Direction</th>
              <th scope="col">Temperature</th>
              <th scope="col">Beaufort Scale</th>
              <th scope="col">Agreement</th>
              <th scope="col" class="visually-hidden">Action</th>
            </tr>
          </thead>
          <tbody>
            ${hours.map((h, i) => {
              const isSelected = i === selectedIndex;
              const arrowRot = (h.directionMean + 180) % 360;
              const consensusBadgeClass =
                h.consensus === 'high' ? 'badge-consensus-high' :
                h.consensus === 'moderate' ? 'badge-consensus-moderate' : 'badge-consensus-divergent';

              return `
                <tr
                  class="table-data-row ${isSelected ? 'selected-row' : ''} ${h.isCurrentHour ? 'current-now-row' : ''}"
                  data-hour-idx="${i}"
                  tabindex="0"
                  role="button"
                  aria-pressed="${isSelected}"
                  aria-label="${h.dayLabel} at ${h.hourLabel}, peak gust ${formatSpeed(h.gustMax, speedUnit)} from ${h.cardinal}"
                >
                  <!-- Sticky Row Header -->
                  <th scope="row" class="col-sticky-time">
                    <span class="cell-day">${h.dayLabel.split(',')[0]}</span>
                    <span class="cell-time">${h.hourLabel}</span>
                    ${h.isCurrentHour ? '<span class="cell-now-badge">Now</span>' : ''}
                  </th>

                  <!-- Peak Gust -->
                  <td class="col-speed">
                    <div class="speed-cell-content">
                      <span class="speed-val-bold gust-val-hero">${convertSpeed(h.gustMax, speedUnit).toFixed(1)}</span>
                      <span class="speed-unit-dim">${speedUnit}</span>
                    </div>
                  </td>

                  <!-- Consensus Mean Gust -->
                  <td class="col-speed-mean">
                    <span class="gust-mean-val">${convertSpeed(h.gustMean, speedUnit).toFixed(1)} ${speedUnit}</span>
                  </td>

                  <!-- Spread Min-Max -->
                  <td class="col-spread">
                    <span class="spread-range">
                      ${convertSpeed(h.gustMin, speedUnit).toFixed(1)} – ${convertSpeed(h.gustMax, speedUnit).toFixed(1)}
                    </span>
                    <span class="spread-dev">±${convertSpeed(h.gustStdDev, speedUnit).toFixed(1)}</span>
                  </td>

                  <!-- Direction -->
                  <td class="col-dir">
                    <div class="dir-cell-content" title="Gusts from ${h.directionMean.toFixed(0)}°">
                      <svg class="table-arrow-icon" style="transform: rotate(${arrowRot}deg);" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                        <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"></path>
                      </svg>
                      <span class="dir-cardinal-bold">${h.cardinal}</span>
                      <span class="dir-degrees-dim">${h.directionMean.toFixed(0)}°</span>
                    </div>
                  </td>

                  <!-- Temp -->
                  <td class="col-temp">
                    <span>${formatTemp(h.tempMean, tempUnit)}</span>
                  </td>

                  <!-- Beaufort -->
                  <td class="col-bft">
                    <span class="bft-tag" style="background-color: ${h.beaufort.color}22; color: ${h.beaufort.color}; border: 1px solid ${h.beaufort.color}55;">
                      F${h.beaufort.number} ${h.beaufort.label}
                    </span>
                  </td>

                  <!-- Agreement -->
                  <td class="col-agreement">
                    <span class="badge ${consensusBadgeClass}">
                      ${h.consensus}
                    </span>
                  </td>

                  <td class="col-action">
                    <button type="button" class="btn btn-outline btn-xs" tabindex="-1" aria-hidden="true">
                      ${isSelected ? 'Active' : 'Select'}
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;

  // Attach event handlers
  container.querySelectorAll<HTMLTableRowElement>('.table-data-row').forEach(row => {
    const handleSelect = () => {
      const idx = parseInt(row.getAttribute('data-hour-idx') || '0', 10);
      callbacks.onHourSelect(idx);
    };

    row.addEventListener('click', handleSelect);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSelect();
      }
    });
  });

  const scrollBtn = container.querySelector<HTMLButtonElement>('#table-scroll-selected-btn');
  scrollBtn?.addEventListener('click', () => {
    const selectedRow = container.querySelector<HTMLTableRowElement>(`.table-data-row[data-hour-idx="${selectedIndex}"]`);
    selectedRow?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

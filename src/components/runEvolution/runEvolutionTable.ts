import { RunEvolutionResult, SpeedUnit } from '../../types';
import { convertSpeed, getSpeedUnitLabel } from '../../utils/units';
import { getBeaufort } from '../../utils/beaufort';

export interface RunEvolutionTableCallbacks {
  onHourSelect: (targetTime: string) => void;
}

export function renderRunEvolutionTable(
  container: HTMLElement,
  result: RunEvolutionResult,
  selectedTime: string | null,
  speedUnit: SpeedUnit,
  activeRunIds: Set<string>,
  callbacks: RunEvolutionTableCallbacks
): void {
  const activeRuns = result.runs.filter(r => activeRunIds.has(r.runId));
  const unitLabel = getSpeedUnitLabel(speedUnit);
  const timeline = result.timeline;

  if (activeRuns.length === 0 || timeline.length === 0) {
    container.innerHTML = '';
    return;
  }

  // Pre-index run hourly data
  const runMaps = activeRuns.map(run => {
    const map = new Map<string, number | null>();
    run.hourly.time.forEach((t, i) => {
      map.set(t, run.hourly.windGusts[i] ?? null);
    });
    return { run, map };
  });

  const latestMap = runMaps[0]?.map;
  const prevMap = runMaps[1]?.map;

  let rowsHtml = '';
  let prevDay = '';

  timeline.forEach((timeStr) => {
    const d = new Date(timeStr);
    const dayName = d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
    const hourStr = `${String(d.getHours()).padStart(2, '0')}:00`;
    const isSelected = selectedTime === timeStr;

    // Day separator banner
    if (dayName !== prevDay) {
      rowsHtml += `
        <tr class="day-divider-row">
          <td colspan="${activeRuns.length + 3}" class="day-divider-cell">
            <strong>${dayName}</strong>
          </td>
        </tr>
      `;
      prevDay = dayName;
    }

    const latestValKmH = latestMap ? latestMap.get(timeStr) ?? null : null;
    const prevValKmH = prevMap ? prevMap.get(timeStr) ?? null : null;

    let deltaHtml = '<span class="muted">-</span>';
    if (latestValKmH !== null && prevValKmH !== null) {
      const deltaKmH = latestValKmH - prevValKmH;
      const deltaDisplay = convertSpeed(deltaKmH, speedUnit);
      if (Math.abs(deltaKmH) >= 2) {
        const cls = deltaKmH < 0 ? 'delta-down' : 'delta-up';
        const sign = deltaKmH > 0 ? '+' : '';
        deltaHtml = `<span class="table-delta-badge ${cls}">${sign}${deltaDisplay.toFixed(1)}</span>`;
      } else {
        deltaHtml = `<span class="muted">~0</span>`;
      }
    }

    const runCellsHtml = runMaps.map(({ run, map }) => {
      const valKmH = map.get(timeStr) ?? null;
      if (valKmH === null || valKmH === undefined) {
        return `<td class="run-cell-empty">-</td>`;
      }
      const valDisplay = convertSpeed(valKmH, speedUnit);
      const bInfo = getBeaufort(valKmH);
      const isLatest = run.isLatest;

      return `
        <td class="run-val-cell ${isLatest ? 'run-latest-cell' : ''}" style="border-left: 3px solid ${bInfo.color};">
          <span class="cell-gust">${valDisplay.toFixed(1)}</span>
        </td>
      `;
    }).join('');

    rowsHtml += `
      <tr class="forecast-row ${isSelected ? 'row-selected' : ''}" data-time="${timeStr}" style="cursor: pointer;">
        <td class="time-cell">
          <strong>${hourStr}</strong>
        </td>
        ${runCellsHtml}
        <td class="delta-cell">
          ${deltaHtml}
        </td>
      </tr>
    `;
  });

  const headerCellsHtml = activeRuns.map(r => `
    <th scope="col" class="${r.isLatest ? 'th-latest' : ''}" style="color: ${r.color};">
      <div>${r.shortLabel}</div>
      <div class="th-sub">${r.relativeLabel}</div>
    </th>
  `).join('');

  container.innerHTML = `
    <section class="table-section evolution-table-section" aria-label="Model Run Evolution Comparison Table">
      <div class="table-header-group">
        <div>
          <h3 class="table-title">Run-by-Run Timeline Comparison (${unitLabel})</h3>
          <span class="table-subtitle">Click any row to pin the target hour across the chart and insights</span>
        </div>
      </div>
      <div class="table-scroll-wrapper">
        <table class="forecast-table evolution-table">
          <thead>
            <tr>
              <th scope="col">Hour</th>
              ${headerCellsHtml}
              <th scope="col">Δ (Latest vs Prev)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </section>
  `;

  // Attach row click listeners
  container.querySelectorAll<HTMLTableRowElement>('.forecast-row').forEach(row => {
    row.addEventListener('click', () => {
      const t = row.getAttribute('data-time');
      if (t) {
        callbacks.onHourSelect(t);
      }
    });
  });
}

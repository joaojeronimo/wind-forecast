import { RunEvolutionResult, SingleRunInfo, SpeedUnit } from '../../types';
import { convertSpeed, formatSpeed, getSpeedUnitLabel } from '../../utils/units';

export function renderRunEvolutionCards(
  container: HTMLElement,
  result: RunEvolutionResult,
  selectedTime: string | null,
  speedUnit: SpeedUnit
): void {
  const latestRun = result.runs[0];
  const previousRun = result.runs[1];
  const unitLabel = getSpeedUnitLabel(speedUnit);

  if (!latestRun) {
    container.innerHTML = '';
    return;
  }

  // Peak gust comparison
  const latestPeak = convertSpeed(latestRun.peakGust, speedUnit);
  const prevPeak = previousRun ? convertSpeed(previousRun.peakGust, speedUnit) : latestPeak;
  const peakDelta = latestPeak - prevPeak;
  const peakDeltaPct = prevPeak > 0 ? (peakDelta / prevPeak) * 100 : 0;

  // Trend categorization
  let trendIcon = '↔';
  let trendClass = 'badge-neutral';
  let trendText = 'Stable across runs';

  if (peakDelta < -8) {
    trendIcon = '▼';
    trendClass = 'badge-weakening';
    trendText = `Weakening / Downgraded (${peakDelta >= 0 ? '+' : ''}${peakDelta.toFixed(1)} ${unitLabel})`;
  } else if (peakDelta > 8) {
    trendIcon = '▲';
    trendClass = 'badge-escalating';
    trendText = `Escalating / Upgraded (+${peakDelta.toFixed(1)} ${unitLabel})`;
  }

  // Calculate volatility across all runs
  const peaks = result.runs.map(r => convertSpeed(r.peakGust, speedUnit));
  const maxAll = Math.max(...peaks);
  const minAll = Math.min(...peaks);
  const volatilitySpread = maxAll - minAll;

  // Peak progression chips (oldest to newest)
  const progressionHtml = [...result.runs].reverse().map(r => {
    const val = convertSpeed(r.peakGust, speedUnit);
    return `
      <div class="progression-step ${r.isLatest ? 'progression-latest' : ''}">
        <span class="progression-run-label" style="color: ${r.color};">${r.shortLabel}</span>
        <span class="progression-val">${val.toFixed(0)} <small>${unitLabel}</small></span>
      </div>
    `;
  }).join('<span class="progression-arrow">➔</span>');

  // Selected Target Hour breakdown
  let selectedHourHtml = '';
  if (selectedTime) {
    const selDate = new Date(selectedTime);
    const selDateStr = selDate.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }) + ` at ${String(selDate.getHours()).padStart(2, '0')}:00`;

    // Extract value for each run at this hour
    const hourRunEntries = result.runs.map(run => {
      const idx = run.hourly.time.indexOf(selectedTime);
      const valKmH = idx >= 0 ? run.hourly.windGusts[idx] : null;
      const valDisplay = valKmH !== null && valKmH !== undefined ? convertSpeed(valKmH, speedUnit) : null;
      return { run, valDisplay };
    });

    const validVals = hourRunEntries.filter(e => e.valDisplay !== null).map(e => e.valDisplay as number);
    const maxHourVal = validVals.length > 0 ? Math.max(...validVals, 30) : 30;
    const latestHourVal = hourRunEntries[0]?.valDisplay ?? null;

    const barsHtml = [...hourRunEntries].reverse().map(entry => {
      const val = entry.valDisplay;
      if (val === null) {
        return `
          <div class="target-hour-bar-row">
            <span class="target-hour-run-name" style="color: ${entry.run.color};">${entry.run.shortLabel} (${entry.run.relativeLabel})</span>
            <span class="target-hour-val muted">N/A</span>
          </div>
        `;
      }

      const barPct = Math.min(100, Math.max(12, (val / maxHourVal) * 100));
      let deltaStr = '';
      if (!entry.run.isLatest && latestHourVal !== null) {
        const d = latestHourVal - val;
        deltaStr = `<span class="target-hour-delta ${d < 0 ? 'delta-down' : d > 0 ? 'delta-up' : ''}">${d >= 0 ? '+' : ''}${d.toFixed(1)}</span>`;
      }

      return `
        <div class="target-hour-bar-row">
          <span class="target-hour-run-name" style="color: ${entry.run.color};">
            ${entry.run.shortLabel} (${entry.run.relativeLabel})
            ${entry.run.isLatest ? '<span class="badge-tag">Current</span>' : ''}
          </span>
          <div class="target-hour-bar-track">
            <div class="target-hour-bar-fill" style="width: ${barPct}%; background-color: ${entry.run.color};"></div>
          </div>
          <span class="target-hour-val">${val.toFixed(1)} ${unitLabel} ${deltaStr}</span>
        </div>
      `;
    }).join('');

    selectedHourHtml = `
      <div class="evolution-card evolution-selected-card">
        <div class="card-header-row">
          <h4 class="card-title">Evolution For Target Hour: <strong>${selDateStr}</strong></h4>
          <span class="card-subtitle">How predictions for this exact moment shifted across runs</span>
        </div>
        <div class="target-hour-bars-list">
          ${barsHtml}
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="evolution-insights-grid">
      <div class="evolution-card">
        <span class="evolution-metric-label">Latest Model Run</span>
        <div class="evolution-metric-value" style="color: #38bdf8;">
          ${latestRun.shortLabel} <span class="evolution-sub-val">(${latestRun.label.split('(')[0].trim()})</span>
        </div>
        <div class="evolution-metric-desc">
          Model: <strong>${result.modelName}</strong> (${result.agency})
        </div>
      </div>

      <div class="evolution-card">
        <span class="evolution-metric-label">Run-over-Run Trend</span>
        <div class="evolution-metric-value">
          <span class="trend-badge ${trendClass}">${trendIcon} ${trendText}</span>
        </div>
        <div class="evolution-metric-desc">
          Latest peak: <strong>${latestPeak.toFixed(1)} ${unitLabel}</strong>
          ${previousRun ? `vs ${prevPeak.toFixed(1)} ${unitLabel} in ${previousRun.shortLabel}` : ''}
        </div>
      </div>

      <div class="evolution-card">
        <span class="evolution-metric-label">Forecast Volatility Spread</span>
        <div class="evolution-metric-value">
          ${volatilitySpread.toFixed(1)} <small>${unitLabel}</small>
        </div>
        <div class="evolution-metric-desc">
          Spread across ${result.runs.length} runs: Min ${minAll.toFixed(0)} to Max ${maxAll.toFixed(0)} ${unitLabel}
        </div>
      </div>
    </div>

    <div class="evolution-card progression-card">
      <div class="progression-header">
        <span class="card-title">Peak Gust Trajectory Across Runs (Oldest ➔ Newest)</span>
        <span class="card-subtitle">Tracking how peak storm intensity moved across consecutive runs</span>
      </div>
      <div class="progression-track">
        ${progressionHtml}
      </div>
    </div>

    ${selectedHourHtml}
  `;
}

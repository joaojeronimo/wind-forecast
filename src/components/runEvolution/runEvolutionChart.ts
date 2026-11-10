import { RunEvolutionResult, SingleRunInfo, SpeedUnit } from '../../types';
import { convertSpeed, formatSpeed, getSpeedUnitLabel } from '../../utils/units';

export interface RunEvolutionChartCallbacks {
  onHourSelect: (targetTime: string) => void;
}

export class RunEvolutionChart {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private result: RunEvolutionResult | null = null;
  private activeRunIds: Set<string> = new Set();
  private selectedTime: string | null = null;
  private speedUnit: SpeedUnit = 'kmh';
  private callbacks: RunEvolutionChartCallbacks;
  private resizeObserver: ResizeObserver | null = null;
  private isHovering = false;
  private hoverIndex = -1;

  constructor(container: HTMLElement, callbacks: RunEvolutionChartCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.container.innerHTML = `
      <section class="chart-section" aria-label="Model Run Evolution Comparison Chart">
        <div class="chart-header">
          <div class="chart-title-group">
            <h3 class="chart-title">Model Run Evolution & Forecast Drift</h3>
            <span class="chart-subtitle">Compare consecutive model runs over the same forecast timeline</span>
          </div>
          <div class="chart-legend" id="evolution-chart-legend" aria-label="Run legend"></div>
        </div>
        <div class="canvas-wrapper">
          <canvas id="evolution-chart-canvas" class="wind-chart-canvas"></canvas>
        </div>
      </section>
    `;

    this.canvas = this.container.querySelector<HTMLCanvasElement>('#evolution-chart-canvas')!;
    this.ctx = this.canvas.getContext('2d');

    this.setupEvents();
    this.setupResize();
  }

  public update(
    result: RunEvolutionResult,
    activeRunIds: Set<string>,
    selectedTime: string | null,
    speedUnit: SpeedUnit
  ): void {
    this.result = result;
    this.activeRunIds = activeRunIds;
    this.selectedTime = selectedTime;
    this.speedUnit = speedUnit;
    this.renderLegend();
    this.draw();
  }

  public setSelectedTime(time: string | null): void {
    this.selectedTime = time;
    this.draw();
  }

  private setupResize(): void {
    this.resizeObserver = new ResizeObserver(() => {
      this.draw();
    });
    this.resizeObserver.observe(this.canvas);
  }

  private getHorizontalPadding(width: number): { padLeft: number; padRight: number } {
    if (width < 480) {
      return { padLeft: 38, padRight: 12 };
    }
    return { padLeft: 45, padRight: 20 };
  }

  private setupEvents(): void {
    const handleMove = (e: MouseEvent) => {
      if (!this.result || this.result.timeline.length === 0) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const { padLeft, padRight } = this.getHorizontalPadding(rect.width);
      const chartWidth = rect.width - padLeft - padRight;
      if (x < padLeft || x > rect.width - padRight) {
        this.isHovering = false;
        this.draw();
        return;
      }
      const fraction = (x - padLeft) / chartWidth;
      const idx = Math.round(fraction * (this.result.timeline.length - 1));
      this.hoverIndex = Math.max(0, Math.min(this.result.timeline.length - 1, idx));
      this.isHovering = true;
      this.draw();
    };

    this.canvas.addEventListener('mousemove', handleMove);
    this.canvas.addEventListener('mouseleave', () => {
      this.isHovering = false;
      this.draw();
    });

    this.canvas.addEventListener('click', (e: MouseEvent) => {
      if (!this.result || this.result.timeline.length === 0) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const { padLeft, padRight } = this.getHorizontalPadding(rect.width);
      const chartWidth = rect.width - padLeft - padRight;
      if (x >= padLeft && x <= rect.width - padRight) {
        const fraction = (x - padLeft) / chartWidth;
        const idx = Math.round(fraction * (this.result.timeline.length - 1));
        const targetTime = this.result.timeline[idx];
        if (targetTime) {
          this.callbacks.onHourSelect(targetTime);
        }
      }
    });

    // Touch support
    this.canvas.addEventListener('touchmove', (e: TouchEvent) => {
      if (!this.result || this.result.timeline.length === 0 || e.touches.length === 0) return;
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const { padLeft, padRight } = this.getHorizontalPadding(rect.width);
      const chartWidth = rect.width - padLeft - padRight;
      if (x >= padLeft && x <= rect.width - padRight) {
        const fraction = (x - padLeft) / chartWidth;
        const idx = Math.round(fraction * (this.result.timeline.length - 1));
        this.hoverIndex = Math.max(0, Math.min(this.result.timeline.length - 1, idx));
        this.isHovering = true;
        this.draw();
      }
    }, { passive: true });

    this.canvas.addEventListener('touchend', () => {
      if (this.isHovering && this.hoverIndex >= 0 && this.result) {
        const targetTime = this.result.timeline[this.hoverIndex];
        if (targetTime) {
          this.callbacks.onHourSelect(targetTime);
        }
      }
      this.isHovering = false;
      this.draw();
    });
  }

  private renderLegend(): void {
    const legendEl = this.container.querySelector<HTMLElement>('#evolution-chart-legend');
    if (!legendEl || !this.result) return;

    legendEl.innerHTML = this.result.runs.map(run => {
      const active = this.activeRunIds.has(run.runId);
      const latestBadge = run.isLatest ? `<span class="legend-badge">Latest</span>` : '';
      return `
        <span class="legend-item ${active ? '' : 'legend-item-disabled'}" data-run-id="${run.runId}" style="cursor: pointer;" title="Toggle ${run.label}">
          <span class="legend-color-dot" style="background-color: ${run.color}; ${run.isLatest ? 'box-shadow: 0 0 6px ' + run.color + ';' : ''}"></span>
          <span class="legend-name">${run.relativeLabel} (${run.shortLabel})</span>
          ${latestBadge}
        </span>
      `;
    }).join('');

    // Toggle run on legend click
    legendEl.querySelectorAll<HTMLElement>('.legend-item').forEach(el => {
      el.addEventListener('click', () => {
        const runId = el.getAttribute('data-run-id');
        if (!runId) return;
        if (this.activeRunIds.has(runId)) {
          if (this.activeRunIds.size > 1) {
            this.activeRunIds.delete(runId);
          }
        } else {
          this.activeRunIds.add(runId);
        }
        this.renderLegend();
        this.draw();
      });
    });
  }

  public draw(): void {
    if (!this.ctx || !this.result || this.result.timeline.length === 0) return;

    const canvas = this.canvas;
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height || 260;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.resetTransform?.();
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const { padLeft, padRight } = this.getHorizontalPadding(width);
    const padTop = 22;
    const padBottom = 34;
    const chartWidth = width - padLeft - padRight;
    const chartHeight = height - padTop - padBottom;

    if (chartWidth <= 0 || chartHeight <= 0) return;

    const timeline = this.result.timeline;
    const n = timeline.length;

    // Build map for each active run's values across timeline
    const activeRuns = this.result.runs.filter(r => this.activeRunIds.has(r.runId));
    let maxGustKmH = 40;

    const runValuesMap = new Map<string, (number | null)[]>();
    for (const run of activeRuns) {
      const timeMap = new Map<string, number | null>();
      run.hourly.time.forEach((t, i) => {
        timeMap.set(t, run.hourly.windGusts[i] ?? null);
      });

      const vals = timeline.map(t => timeMap.get(t) ?? null);
      runValuesMap.set(run.runId, vals);

      for (const v of vals) {
        if (v !== null && v > maxGustKmH) {
          maxGustKmH = v;
        }
      }
    }

    const maxSpeedDisplay = convertSpeed(maxGustKmH, this.speedUnit);
    const yAxisMax = Math.ceil((maxSpeedDisplay * 1.15) / 10) * 10 || 40;
    const unitLabel = getSpeedUnitLabel(this.speedUnit);

    const getX = (index: number) => padLeft + (index / (n - 1)) * chartWidth;
    const getY = (valDisplay: number) => padTop + chartHeight - (valDisplay / yAxisMax) * chartHeight;

    // Draw horizontal grid lines & Y labels
    const gridSteps = 4;
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillStyle = 'rgba(160, 174, 192, 0.8)';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= gridSteps; i++) {
      const stepVal = Math.round((yAxisMax / gridSteps) * i);
      const y = getY(stepVal);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();

      ctx.fillText(`${stepVal} ${i === gridSteps ? unitLabel : ''}`, padLeft - 6, y);
    }

    // Draw Day divider lines & X-axis labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    let lastDateStr = '';

    for (let i = 0; i < n; i++) {
      const t = timeline[i];
      const d = new Date(t);
      const dateStr = d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
      const x = getX(i);

      if (dateStr !== lastDateStr && i > 0) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.setLineDash([3, 3]);
        ctx.moveTo(x, padTop);
        ctx.lineTo(x, padTop + chartHeight);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
        ctx.fillText(dateStr, x, padTop + chartHeight + 16);
        lastDateStr = dateStr;
      } else if (i === 0) {
        lastDateStr = dateStr;
        ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
        ctx.fillText(dateStr, x + 20, padTop + chartHeight + 16);
      }

      // Time labels every 6 hours
      const hour = d.getHours();
      if (hour % 6 === 0) {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
        ctx.fillText(`${String(hour).padStart(2, '0')}:00`, x, padTop + chartHeight + 4);
      }
    }

    // Draw selected time indicator
    const selectedIndex = this.selectedTime ? timeline.indexOf(this.selectedTime) : -1;
    if (selectedIndex >= 0) {
      const selX = getX(selectedIndex);
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.moveTo(selX, padTop);
      ctx.lineTo(selX, padTop + chartHeight);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw lines for each run (oldest runs first, latest on top)
    const reversedRuns = [...activeRuns].reverse();
    for (const run of reversedRuns) {
      const vals = runValuesMap.get(run.runId);
      if (!vals) continue;

      ctx.beginPath();
      let started = false;
      for (let i = 0; i < n; i++) {
        const v = vals[i];
        if (v === null) continue;
        const vDisplay = convertSpeed(v, this.speedUnit);
        const x = getX(i);
        const y = getY(vDisplay);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.strokeStyle = run.color;
      if (run.isLatest) {
        ctx.lineWidth = 3;
        ctx.shadowColor = run.color;
        ctx.shadowBlur = 8;
      } else {
        ctx.lineWidth = 1.8;
        ctx.shadowBlur = 0;
      }
      ctx.stroke();
      ctx.shadowBlur = 0; // reset
    }

    // Draw hover crosshair & tooltip
    const activeHoverIndex = this.isHovering ? this.hoverIndex : selectedIndex;
    if (activeHoverIndex >= 0 && activeHoverIndex < n) {
      const hoverX = getX(activeHoverIndex);
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1;
      ctx.moveTo(hoverX, padTop);
      ctx.lineTo(hoverX, padTop + chartHeight);
      ctx.stroke();

      // Draw dots on each run
      const tooltipItems: { label: string; value: number; color: string; isLatest: boolean }[] = [];

      for (const run of activeRuns) {
        const vals = runValuesMap.get(run.runId);
        const v = vals ? vals[activeHoverIndex] : null;
        if (v !== null && v !== undefined) {
          const vDisplay = convertSpeed(v, this.speedUnit);
          const y = getY(vDisplay);
          ctx.beginPath();
          ctx.arc(hoverX, y, run.isLatest ? 5 : 3.5, 0, Math.PI * 2);
          ctx.fillStyle = run.color;
          ctx.fill();
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          tooltipItems.push({
            label: `${run.relativeLabel} (${run.shortLabel})`,
            value: vDisplay,
            color: run.color,
            isLatest: run.isLatest
          });
        }
      }

      // Draw Tooltip Box
      if (tooltipItems.length > 0) {
        const hoverTimeStr = timeline[activeHoverIndex];
        const hoverDate = new Date(hoverTimeStr);
        const timeTitle = hoverDate.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        }) + ` at ${String(hoverDate.getHours()).padStart(2, '0')}:00`;

        const boxWidth = 195;
        const lineH = 18;
        const boxHeight = 28 + tooltipItems.length * lineH;
        let boxX = hoverX + 12;
        if (boxX + boxWidth > width - padRight) {
          boxX = hoverX - boxWidth - 12;
        }
        const boxY = Math.max(padTop + 4, Math.min(height - padBottom - boxHeight, 35));

        ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 6) : ctx.rect(boxX, boxY, boxWidth, boxHeight);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(timeTitle, boxX + 10, boxY + 8);

        const latestVal = tooltipItems.find(t => t.isLatest)?.value;

        tooltipItems.forEach((item, idx) => {
          const itemY = boxY + 26 + idx * lineH;
          ctx.fillStyle = item.color;
          ctx.beginPath();
          ctx.arc(boxX + 14, itemY + 6, 3.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#cbd5e1';
          ctx.font = item.isLatest ? 'bold 10.5px sans-serif' : '10px sans-serif';
          ctx.fillText(item.label, boxX + 24, itemY);

          // Value and Delta
          let deltaStr = '';
          if (!item.isLatest && latestVal !== undefined) {
            const delta = latestVal - item.value;
            deltaStr = delta >= 0 ? ` (+${delta.toFixed(1)})` : ` (${delta.toFixed(1)})`;
          }

          ctx.fillStyle = item.isLatest ? '#38bdf8' : '#e2e8f0';
          ctx.textAlign = 'right';
          ctx.fillText(`${item.value.toFixed(1)} ${unitLabel}${deltaStr}`, boxX + boxWidth - 8, itemY);
          ctx.textAlign = 'left';
        });
      }
    }
  }
}

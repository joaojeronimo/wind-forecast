import { AggregatedHour, SpeedUnit, ModelId } from '../types';
import { AVAILABLE_MODELS } from '../api/openMeteo';
import { convertSpeed, getSpeedUnitLabel } from '../utils/units';

export interface WindChartCallbacks {
  onHourSelect: (index: number) => void;
}

export class WindChart {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private hours: AggregatedHour[] = [];
  private selectedIndex = 0;
  private speedUnit: SpeedUnit = 'kmh';
  private activeModelIds: ModelId[] = [];
  private callbacks: WindChartCallbacks;
  private resizeObserver: ResizeObserver | null = null;
  private isHovering = false;
  private hoverIndex = -1;

  constructor(container: HTMLElement, callbacks: WindChartCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.container.innerHTML = `
      <section class="chart-section" aria-label="48-Hour Multi-Model Wind Gusts Chart">
        <div class="chart-header">
          <div class="chart-title-group">
            <h3 class="chart-title">48-Hour Wind Gusts Forecast & Multi-Model Comparison</h3>
            <span class="chart-subtitle">Ensemble gust corridor (min to peak max) & model curves</span>
          </div>
          <div class="chart-legend" id="chart-legend" aria-hidden="true"></div>
        </div>
        <div class="canvas-wrapper">
          <canvas id="wind-chart-canvas" class="wind-chart-canvas"></canvas>
        </div>
      </section>
    `;

    this.canvas = this.container.querySelector<HTMLCanvasElement>('#wind-chart-canvas')!;
    this.ctx = this.canvas.getContext('2d');

    this.setupEvents();
    this.setupResize();
  }

  public update(
    hours: AggregatedHour[],
    selectedIndex: number,
    speedUnit: SpeedUnit,
    activeModelIds: ModelId[]
  ): void {
    this.hours = hours;
    this.selectedIndex = selectedIndex;
    this.speedUnit = speedUnit;
    this.activeModelIds = activeModelIds;
    this.renderLegend();
    this.draw();
  }

  public setSelectedIndex(index: number): void {
    this.selectedIndex = index;
    this.draw();
  }

  private setupResize(): void {
    this.resizeObserver = new ResizeObserver(() => {
      this.draw();
    });
    this.resizeObserver.observe(this.canvas);
  }

  private setupEvents(): void {
    const handleMove = (e: MouseEvent) => {
      if (this.hours.length === 0) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const paddingLeft = 45;
      const paddingRight = 20;
      const chartWidth = rect.width - paddingLeft - paddingRight;
      if (x < paddingLeft || x > rect.width - paddingRight) {
        this.isHovering = false;
        this.draw();
        return;
      }
      const fraction = (x - paddingLeft) / chartWidth;
      const idx = Math.round(fraction * (this.hours.length - 1));
      this.hoverIndex = Math.max(0, Math.min(this.hours.length - 1, idx));
      this.isHovering = true;
      this.draw();
    };

    this.canvas.addEventListener('mousemove', handleMove);
    this.canvas.addEventListener('mouseleave', () => {
      this.isHovering = false;
      this.draw();
    });

    this.canvas.addEventListener('click', () => {
      if (this.isHovering && this.hoverIndex >= 0) {
        this.callbacks.onHourSelect(this.hoverIndex);
      }
    });

    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const paddingLeft = 45;
        const chartWidth = rect.width - paddingLeft - 20;
        const fraction = (x - paddingLeft) / chartWidth;
        const idx = Math.round(fraction * (this.hours.length - 1));
        const clamped = Math.max(0, Math.min(this.hours.length - 1, idx));
        this.callbacks.onHourSelect(clamped);
      }
    }, { passive: true });
  }

  private renderLegend(): void {
    const legend = this.container.querySelector<HTMLElement>('#chart-legend');
    if (!legend) return;

    const modelLookup = new Map(AVAILABLE_MODELS.map(m => [m.id, m]));
    legend.innerHTML = `
      <div class="legend-item">
        <span class="legend-swatch band-swatch"></span>
        <span>Gust Spread (Min-Max)</span>
      </div>
      <div class="legend-item">
        <span class="legend-swatch mean-swatch"></span>
        <span>Consensus Mean Gust</span>
      </div>
      ${this.activeModelIds.slice(0, 5).map(id => {
        const m = modelLookup.get(id);
        if (!m) return '';
        return `
          <div class="legend-item">
            <span class="legend-swatch" style="background-color: ${m.color};"></span>
            <span>${m.name}</span>
          </div>
        `;
      }).join('')}
    `;
  }

  private draw(): void {
    if (!this.ctx || this.hours.length === 0) return;

    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width;
    const height = Math.max(260, rect.height || 280);

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);

    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);

    const isDark = document.body.classList.contains('theme-dark') ||
      (!document.body.classList.contains('theme-light') && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const padLeft = 45;
    const padRight = 20;
    const padTop = 20;
    const padBottom = 55;

    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    // Determine max speed for Y-axis scaling based on Peak Gusts
    let maxGust = 10;
    for (const h of this.hours) {
      const convertedPeak = convertSpeed(h.gustMax, this.speedUnit);
      if (convertedPeak > maxGust) maxGust = convertedPeak;
    }
    maxGust = Math.ceil((maxGust + 4) / 5) * 5;

    const getX = (i: number) => padLeft + (i / (this.hours.length - 1)) * chartW;
    const getY = (val: number) => padTop + chartH - (val / maxGust) * chartH;

    // 1. Grid lines and Y-axis labels
    const yTicks = 5;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let t = 0; t <= yTicks; t++) {
      const tickVal = (maxGust / yTicks) * t;
      const y = getY(tickVal);

      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();

      ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
      ctx.fillText(`${tickVal.toFixed(0)} ${getSpeedUnitLabel(this.speedUnit)}`, padLeft - 6, y);
    }

    // 2. Spread Corridor for Gusts (Min to Max confidence band)
    ctx.beginPath();
    for (let i = 0; i < this.hours.length; i++) {
      const x = getX(i);
      const yMax = getY(convertSpeed(this.hours[i].gustMax, this.speedUnit));
      if (i === 0) ctx.moveTo(x, yMax);
      else ctx.lineTo(x, yMax);
    }
    for (let i = this.hours.length - 1; i >= 0; i--) {
      const x = getX(i);
      const yMin = getY(convertSpeed(this.hours[i].gustMin, this.speedUnit));
      ctx.lineTo(x, yMin);
    }
    ctx.closePath();
    ctx.fillStyle = isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(217, 119, 6, 0.12)';
    ctx.fill();

    // 3. Individual Model Gust Curves
    const modelLookup = new Map(AVAILABLE_MODELS.map(m => [m.id, m]));
    for (const modelId of this.activeModelIds) {
      const model = modelLookup.get(modelId);
      if (!model) continue;

      ctx.beginPath();
      let hasStarted = false;
      for (let i = 0; i < this.hours.length; i++) {
        const pt = this.hours[i].modelValues[modelId];
        if (pt && !isNaN(pt.gust)) {
          const x = getX(i);
          const y = getY(convertSpeed(pt.gust, this.speedUnit));
          if (!hasStarted) {
            ctx.moveTo(x, y);
            hasStarted = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.strokeStyle = `${model.color}88`;
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }

    // 4. Consensus Mean Gust Line
    ctx.beginPath();
    for (let i = 0; i < this.hours.length; i++) {
      const x = getX(i);
      const y = getY(convertSpeed(this.hours[i].gustMean, this.speedUnit));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = isDark ? '#f59e0b' : '#d97706';
    ctx.lineWidth = 2.8;
    ctx.stroke();

    // 5. Time Markers & Wind Arrows on X-Axis
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let i = 0; i < this.hours.length; i++) {
      const h = this.hours[i];
      const x = getX(i);

      if (h.date.getHours() === 0 && i > 0) {
        ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.25)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x, padTop);
        ctx.lineTo(x, padTop + chartH);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = isDark ? '#f1f5f9' : '#0f172a';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(h.dayLabel, x + 25, padTop + 4);
      }

      if (i % 3 === 0 || i === this.hours.length - 1) {
        const arrowY = padTop + chartH + 16;
        const arrowRot = ((h.directionMean + 180) % 360) * (Math.PI / 180);

        ctx.save();
        ctx.translate(x, arrowY);
        ctx.rotate(arrowRot);
        ctx.fillStyle = isDark ? '#e2e8f0' : '#334155';
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(4, 5);
        ctx.lineTo(0, 2);
        ctx.lineTo(-4, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.font = '10px sans-serif';
        ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
        ctx.fillText(h.hourLabel, x, padTop + chartH + 30);
      }
    }

    // 6. Selected Hour Cursor Line
    const activeIdx = this.isHovering ? this.hoverIndex : this.selectedIndex;
    if (activeIdx >= 0 && activeIdx < this.hours.length) {
      const activeHour = this.hours[activeIdx];
      const cursorX = getX(activeIdx);
      const cursorY = getY(convertSpeed(activeHour.gustMax, this.speedUnit));

      ctx.strokeStyle = isDark ? '#38bdf8' : '#0284c7';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(cursorX, padTop);
      ctx.lineTo(cursorX, padTop + chartH + 45);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = isDark ? '#38bdf8' : '#0284c7';
      ctx.beginPath();
      ctx.arc(cursorX, cursorY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isDark ? '#0f172a' : '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      const peakStr = `${convertSpeed(activeHour.gustMax, this.speedUnit).toFixed(1)} ${getSpeedUnitLabel(this.speedUnit)}`;
      const tooltipText = `${activeHour.hourLabel} • Peak Gust: ${peakStr} ${activeHour.cardinal}`;
      ctx.font = 'bold 11px sans-serif';
      const textMetrics = ctx.measureText(tooltipText);
      const boxW = textMetrics.width + 16;
      const boxH = 22;
      let boxX = cursorX - boxW / 2;
      if (boxX < padLeft) boxX = padLeft;
      if (boxX + boxW > width - padRight) boxX = width - padRight - boxW;
      const boxY = Math.max(padTop + 2, cursorY - 32);

      ctx.fillStyle = isDark ? '#1e293b' : '#ffffff';
      ctx.strokeStyle = isDark ? '#38bdf8' : '#0284c7';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(boxX, boxY, boxW, boxH, 4) : ctx.rect(boxX, boxY, boxW, boxH);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tooltipText, boxX + boxW / 2, boxY + boxH / 2);
    }
  }
}

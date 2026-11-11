import { AggregatedHour, SpeedUnit, ModelId } from '../types';
import { AVAILABLE_MODELS } from '../api/openMeteo';
import { convertSpeed, convertSpeedToKmh, getSpeedUnitLabel } from '../utils/units';
import { getBeaufort } from '../utils/beaufort';

export interface WindChartCallbacks {
  onHourSelect: (index: number) => void;
}

export interface WindChartOptions {
  idPrefix?: string;
  isExtended?: boolean;
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
  private idPrefix: string;
  private isExtended: boolean;

  constructor(container: HTMLElement, callbacks: WindChartCallbacks, options?: WindChartOptions) {
    this.container = container;
    this.callbacks = callbacks;
    this.idPrefix = options?.idPrefix ?? '';
    this.isExtended = options?.isExtended ?? false;
    const p = this.idPrefix;

    this.container.innerHTML = `
      <section class="chart-section" id="${p}chart-section" aria-label="${this.isExtended ? 'Extended Multi-Model Wind Gusts Chart' : '48-Hour Multi-Model Wind Gusts Chart'}">
        <div class="chart-header">
          <div class="chart-title-group">
            <h3 class="chart-title" id="${p}chart-title">${this.isExtended ? 'Extended Multi-Day Wind Gusts Forecast & Multi-Model Comparison' : '48-Hour Wind Gusts Forecast & Multi-Model Comparison'}</h3>
            <span class="chart-subtitle" id="${p}chart-subtitle">Ensemble gust corridor (min to peak max) & model curves</span>
          </div>
          <div class="chart-legend" id="${p}chart-legend" aria-hidden="true"></div>
        </div>
        <div class="canvas-wrapper">
          <canvas id="${p}wind-chart-canvas" class="wind-chart-canvas"></canvas>
        </div>
      </section>
    `;

    this.canvas = this.container.querySelector<HTMLCanvasElement>(`#${p}wind-chart-canvas`)!;
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

    if (this.isExtended && hours.length > 0) {
      const p = this.idPrefix;
      const days = Math.max(1, Math.ceil(hours.length / 24));
      const lastHour = hours[hours.length - 1];
      const titleEl = this.container.querySelector(`#${p}chart-title`);
      const subEl = this.container.querySelector(`#${p}chart-subtitle`);
      if (titleEl) {
        titleEl.textContent = `Extended ${days}-Day (${hours.length}h) Wind Gusts Forecast & Multi-Model Comparison`;
      }
      if (subEl && lastHour) {
        subEl.textContent = `All available future model data through ${lastHour.dayLabel} at ${lastHour.hourLabel} • Ensemble corridor & model curves`;
      }
    }

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

  private getHorizontalPadding(width: number): { padLeft: number; padRight: number } {
    if (width < 480) {
      return { padLeft: 48, padRight: 14 };
    }
    return { padLeft: 56, padRight: 20 };
  }

  private setupEvents(): void {
    const handleMove = (e: MouseEvent) => {
      if (this.hours.length === 0) return;
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

    const handleTouch = (e: TouchEvent) => {
      if (this.hours.length === 0 || e.touches.length === 0) return;
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const { padLeft, padRight } = this.getHorizontalPadding(rect.width);
      const chartWidth = Math.max(1, rect.width - padLeft - padRight);
      const fraction = (x - padLeft) / chartWidth;
      const idx = Math.round(fraction * (this.hours.length - 1));
      const clamped = Math.max(0, Math.min(this.hours.length - 1, idx));
      this.callbacks.onHourSelect(clamped);
    };

    this.canvas.addEventListener('touchstart', handleTouch, { passive: true });
    this.canvas.addEventListener('touchmove', handleTouch, { passive: true });
  }

  private renderLegend(): void {
    const legend = this.container.querySelector<HTMLElement>(`#${this.idPrefix}chart-legend`);
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
      ${this.activeModelIds.map(id => {
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
    const height = Math.max(240, rect.height || 280);

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);

    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);

    const isDark = document.body.classList.contains('theme-dark') ||
      (!document.body.classList.contains('theme-light') && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const { padLeft, padRight } = this.getHorizontalPadding(width);
    const padTop = 20;
    const padBottom = 55;

    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    if (chartW <= 0 || chartH <= 0) return;

    // Determine max speed for Y-axis scaling based on Peak Gusts
    let maxGust = 10;
    for (const h of this.hours) {
      const convertedPeak = convertSpeed(h.gustMax, this.speedUnit);
      if (convertedPeak > maxGust) maxGust = convertedPeak;
    }
    maxGust = Math.ceil((maxGust + 4) / 5) * 5;

    const getX = (i: number) => padLeft + (i / Math.max(1, this.hours.length - 1)) * chartW;
    const getY = (val: number) => padTop + chartH - (val / maxGust) * chartH;

    // 1a. Beaufort Y-axis color strip
    const yStripGrad = ctx.createLinearGradient(0, padTop + chartH, 0, padTop);
    const stripSteps = 20;
    for (let s = 0; s <= stripSteps; s++) {
      const ratio = s / stripSteps;
      const valKmh = convertSpeedToKmh(ratio * maxGust, this.speedUnit);
      yStripGrad.addColorStop(ratio, getBeaufort(valKmh).color);
    }
    ctx.fillStyle = yStripGrad;
    ctx.fillRect(padLeft - 3, padTop, 3, chartH);

    // 1b. Beaufort X-axis color baseline strip
    if (this.hours.length > 1) {
      const xStripGrad = ctx.createLinearGradient(padLeft, 0, padLeft + chartW, 0);
      const maxHIdx = this.hours.length - 1;
      for (let i = 0; i <= maxHIdx; i++) {
        xStripGrad.addColorStop(i / maxHIdx, this.hours[i].beaufort.color);
      }
      ctx.fillStyle = xStripGrad;
      ctx.fillRect(padLeft, padTop + chartH, chartW, 3);
    }

    // 1c. Grid lines and Y-axis labels colored by Beaufort scale
    const yTicks = 5;
    ctx.font = width < 480 ? 'bold 10px sans-serif' : 'bold 11px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let t = 0; t <= yTicks; t++) {
      const tickVal = Math.round((maxGust / yTicks) * t);
      const y = getY(tickVal);
      const tickKmh = convertSpeedToKmh(tickVal, this.speedUnit);
      const bftColor = getBeaufort(tickKmh).color;

      ctx.strokeStyle = isDark ? `${bftColor}26` : `${bftColor}33`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();

      ctx.fillStyle = bftColor;
      ctx.fillText(`${tickVal} ${getSpeedUnitLabel(this.speedUnit)}`, padLeft - 7, y);
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

    const isMultiDay = this.hours.length > 72 || this.isExtended;
    let hourStep = chartW >= 680 ? 3 : chartW >= 320 ? 6 : 8;
    if (isMultiDay) {
      const maxTickCount = Math.max(4, Math.floor(chartW / 58));
      const candidateSteps = [6, 12, 24, 48, 72];
      hourStep = candidateSteps.find(step => this.hours.length / step <= maxTickCount) ?? 72;
    }

    const totalDays = Math.max(1, Math.ceil(this.hours.length / 24));
    const dayLabelStep = isMultiDay ? Math.max(1, Math.ceil((totalDays * 78) / chartW)) : 1;
    let midnightCounter = 0;
    const maxIdx = this.hours.length - 1;

    for (let i = 0; i < this.hours.length; i++) {
      const h = this.hours[i];
      const x = getX(i);

      if (h.date.getHours() === 0 && i > 0) {
        const shouldLabelDay = midnightCounter % dayLabelStep === 0;
        midnightCounter++;

        ctx.strokeStyle = isDark
          ? (shouldLabelDay ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.1)')
          : (shouldLabelDay ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.1)');
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x, padTop);
        ctx.lineTo(x, padTop + chartH);
        ctx.stroke();
        ctx.setLineDash([]);

        if (shouldLabelDay && x < width - padRight - 42) {
          ctx.fillStyle = isDark ? '#f1f5f9' : '#0f172a';
          ctx.font = 'bold 10px sans-serif';
          const dayX = Math.min(x + 28, width - padRight - 24);
          ctx.fillText(h.dayLabel, dayX, padTop + 4);
        }
      }

      const isStepTick = i % hourStep === 0;
      const isLastTick = i === maxIdx && (maxIdx % hourStep >= Math.ceil(hourStep * 0.65));

      if (isStepTick || isLastTick) {
        const arrowY = padTop + chartH + 16;
        const arrowRot = ((h.directionMean + 180) % 360) * (Math.PI / 180);

        ctx.save();
        ctx.translate(x, arrowY);
        ctx.rotate(arrowRot);
        ctx.fillStyle = h.beaufort.color;
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(4, 5);
        ctx.lineTo(0, 2);
        ctx.lineTo(-4, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = h.beaufort.color;
        const labelX = i === maxIdx && width < 480 ? Math.min(x, width - 18) : x;
        const bottomLabel = isMultiDay && hourStep >= 24
          ? h.date.toLocaleDateString([], { weekday: 'short', day: 'numeric' })
          : h.hourLabel;
        ctx.fillText(bottomLabel, labelX, padTop + chartH + 30);
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
      const tooltipText = isMultiDay
        ? `${activeHour.dayLabel} ${activeHour.hourLabel} • Peak: ${peakStr} ${activeHour.cardinal} (${activeHour.reportingModelsCount}m)`
        : `${activeHour.hourLabel} • Peak Gust: ${peakStr} ${activeHour.cardinal}`;
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

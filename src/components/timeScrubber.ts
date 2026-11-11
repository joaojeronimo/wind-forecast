import { AggregatedHour, SpeedUnit } from '../types';
import { formatSpeed } from '../utils/units';
import {
  buildGustTimelineGradient,
  getGustIntensityColor,
  isExtremeGust
} from '../utils/beaufort';

export interface TimeScrubberCallbacks {
  onHourSelect: (index: number) => void;
}

export interface TimeScrubberOptions {
  idPrefix?: string;
  isExtended?: boolean;
}

export class TimeScrubber {
  private container: HTMLElement;
  private hours: AggregatedHour[] = [];
  private selectedIndex = 0;
  private speedUnit: SpeedUnit = 'kmh';
  private isPlaying = false;
  private playIntervalId: ReturnType<typeof setInterval> | null = null;
  private callbacks: TimeScrubberCallbacks;
  private idPrefix: string;
  private isExtended: boolean;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(container: HTMLElement, callbacks: TimeScrubberCallbacks, options?: TimeScrubberOptions) {
    this.container = container;
    this.callbacks = callbacks;
    this.idPrefix = options?.idPrefix ?? '';
    this.isExtended = options?.isExtended ?? false;

    this.keydownHandler = (e: KeyboardEvent) => {
      if (this.container.closest('[hidden]') || this.hours.length === 0) {
        return;
      }
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl?.tagName === 'INPUT' && activeEl.id !== `${this.idPrefix}time-range-slider`) {
        return; // ignore when typing in search box
      }
      if (activeEl?.getAttribute('role') === 'tab') {
        return; // do not hijack tablist arrow navigation
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.stepBy(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.stepBy(1);
      } else if (e.key === ' ' && activeEl?.tagName !== 'BUTTON') {
        e.preventDefault();
        this.togglePlay();
      }
    };
    document.addEventListener('keydown', this.keydownHandler);
  }

  public update(hours: AggregatedHour[], selectedIndex: number, speedUnit: SpeedUnit): void {
    this.hours = hours;
    this.selectedIndex = Math.max(0, Math.min(hours.length - 1, selectedIndex));
    this.speedUnit = speedUnit;
    this.render();
  }

  public setSelectedIndex(index: number): void {
    if (this.hours.length === 0) return;
    this.selectedIndex = Math.max(0, Math.min(this.hours.length - 1, index));
    this.updateUI();
  }

  public stopPlay(): void {
    if (this.isPlaying) {
      this.isPlaying = false;
      if (this.playIntervalId) {
        clearInterval(this.playIntervalId);
        this.playIntervalId = null;
      }
      const playBtn = this.container.querySelector<HTMLButtonElement>(`#${this.idPrefix}play-scrub-btn`);
      if (playBtn) {
        playBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          <span>Play Loop</span>
        `;
        playBtn.classList.remove('active');
      }
    }
  }

  public togglePlay(): void {
    if (this.isPlaying) {
      this.stopPlay();
    } else {
      this.isPlaying = true;
      const playBtn = this.container.querySelector<HTMLButtonElement>(`#${this.idPrefix}play-scrub-btn`);
      if (playBtn) {
        playBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
          <span>Pause</span>
        `;
        playBtn.classList.add('active');
      }
      this.playIntervalId = setInterval(() => {
        let next = this.selectedIndex + 1;
        if (next >= this.hours.length) next = 0;
        this.selectedIndex = next;
        this.updateUI();
        this.callbacks.onHourSelect(this.selectedIndex);
      }, this.hours.length > 72 ? 300 : 700);
    }
  }

  private renderExtremeSegments(): string {
    const maxIdx = this.hours.length - 1;
    if (maxIdx <= 0) {
      if (this.hours.length === 1 && isExtremeGust(this.hours[0].gustMax)) {
        return `<span class="slider-extreme-segment" style="left: 0%; width: 100%;"></span>`;
      }
      return '';
    }

    return this.hours
      .map((h, i) => {
        if (!isExtremeGust(h.gustMax)) return '';
        const startRatio = Math.max(0, (i - 0.5) / maxIdx);
        const endRatio = Math.min(1, (i + 0.5) / maxIdx);
        const leftPct = (startRatio * 100).toFixed(2);
        const widthPct = ((endRatio - startRatio) * 100).toFixed(2);
        return `<span class="slider-extreme-segment" style="left: ${leftPct}%; width: ${widthPct}%;"></span>`;
      })
      .join('');
  }

  private renderTicks(): string {
    const maxIdx = this.hours.length - 1;
    if (maxIdx <= 0) return '';

    const isMultiDay = this.hours.length > 72 || this.isExtended;

    if (!isMultiDay) {
      return this.hours
        .map((h, i) => {
          const isLast = i === maxIdx;
          const isSixHour = i % 6 === 0;
          if (isSixHour || isLast) {
            const isCloseToPrevTick = isLast && (maxIdx % 6 !== 0) && (maxIdx % 6 < 4);
            const isMinor = (i % 12 !== 0 && !isLast) || (isLast && maxIdx % 6 !== 0);
            const edgeClass = i === 0 ? 'tick-first' : isLast ? 'tick-last' : '';
            return `
              <div class="tick-mark ${isMinor ? 'tick-minor' : 'tick-major'} ${edgeClass} ${isCloseToPrevTick ? 'tick-crowded' : ''}" style="left: ${(i / maxIdx) * 100}%">
                <span class="tick-line"></span>
                <span class="tick-label">${h.hourLabel}</span>
              </div>
            `;
          }
          return '';
        })
        .join('');
    }

    // Extended multi-day ticks: place ticks every 24h (midnight boundaries or 24h steps), with major labels every 48h
    let midnightCount = 0;
    return this.hours
      .map((h, i) => {
        const isFirst = i === 0;
        const isLast = i === maxIdx;
        const isMidnight = h.date.getHours() === 0 && i > 6 && i < maxIdx - 6;

        if (!isFirst && !isLast && !isMidnight) {
          return '';
        }

        let isMinor = false;
        if (isMidnight) {
          midnightCount++;
          isMinor = midnightCount % 2 === 0;
        }

        const edgeClass = isFirst ? 'tick-first' : isLast ? 'tick-last' : '';
        const shortDay = h.date.toLocaleDateString([], { weekday: 'short', day: 'numeric' });
        return `
          <div class="tick-mark ${isMinor ? 'tick-minor' : 'tick-major'} ${edgeClass}" style="left: ${(i / maxIdx) * 100}%">
            <span class="tick-line"></span>
            <span class="tick-label">${shortDay}</span>
          </div>
        `;
      })
      .join('');
  }

  private render(): void {
    if (this.hours.length === 0) {
      this.container.innerHTML = '';
      return;
    }

    const p = this.idPrefix;
    const current = this.hours[this.selectedIndex] || this.hours[0];
    const maxIdx = this.hours.length - 1;
    const gustsKmh = this.hours.map(h => h.gustMax);
    const timelineGradient = buildGustTimelineGradient(gustsKmh);
    const hasExtremeGusts = gustsKmh.some(g => isExtremeGust(g));
    const currentIsExtreme = isExtremeGust(current.gustMax);
    const currentColor = getGustIntensityColor(current.gustMax);
    const thumbColor = currentIsExtreme ? 'var(--gust-flash-color, #9333ea)' : currentColor;

    const isMultiDay = this.hours.length > 72 || this.isExtended;
    const daysSpan = Math.max(1, Math.ceil(this.hours.length / 24));
    const lastHour = this.hours[maxIdx];
    const sectionLabel = isMultiDay
      ? `Extended ${daysSpan}-Day (${this.hours.length}-Hour) Time Navigation and Gust Scrubber`
      : '48-Hour Time Navigation and Gust Scrubber';
    const sliderLabel = isMultiDay
      ? `Scrub through ${daysSpan} day (${this.hours.length} hour) extended gust predictions`
      : 'Scrub through 48 hour gust predictions';
    const fastStepHours = isMultiDay ? 24 : 6;
    const fastStepLabel = isMultiDay ? '24h' : '6h';

    this.container.innerHTML = `
      <section class="time-scrubber-section" aria-label="${sectionLabel}">
        <!-- Time status row -->
        <div class="scrubber-header-row">
          <div class="time-status-pill">
            <span class="pulse-indicator ${current.isCurrentHour ? 'active' : ''}"></span>
            <span class="active-time-label" id="${p}scrubber-active-time">${current.dayLabel} at ${current.hourLabel}</span>
            <span class="relative-time-badge" id="${p}scrubber-relative-badge">${this.getRelativeLabel(current)}</span>
            ${isMultiDay ? `<span class="horizon-pill-badge" title="Furthest available forecast data reaches ${lastHour.dayLabel} ${lastHour.hourLabel}">${daysSpan}d / ${this.hours.length}h Horizon</span>` : ''}
          </div>

          <div class="scrubber-quick-stats">
            <span class="quick-speed ${currentIsExtreme ? 'is-extreme-gust' : ''}" id="${p}scrubber-quick-speed" style="--quick-gust-color: ${currentColor};">Peak Gust: ${formatSpeed(current.gustMax, this.speedUnit)}</span>
            <span class="quick-dir" id="${p}scrubber-quick-dir">${current.cardinal} (${current.directionMean.toFixed(0)}°)</span>
          </div>
        </div>

        <!-- Slider Bar -->
        <div class="slider-wrapper ${hasExtremeGusts ? 'has-extreme-gusts' : ''}">
          <label for="${p}time-range-slider" class="visually-hidden">${sliderLabel}</label>
          <div class="slider-timeline-track" id="${p}slider-timeline-track" aria-hidden="true" style="background: ${timelineGradient};">
            ${this.renderExtremeSegments()}
          </div>
          <input
            type="range"
            id="${p}time-range-slider"
            class="time-range-slider ${hasExtremeGusts ? 'has-extreme-gusts' : ''} ${currentIsExtreme ? 'is-extreme-gust' : ''}"
            min="0"
            max="${maxIdx}"
            value="${this.selectedIndex}"
            step="1"
            style="--slider-track-gradient: ${timelineGradient}; --slider-thumb-color: ${thumbColor};"
            aria-valuemin="0"
            aria-valuemax="${maxIdx}"
            aria-valuenow="${this.selectedIndex}"
            aria-valuetext="${current.dayLabel} ${current.hourLabel}, Peak Gust ${formatSpeed(current.gustMax, this.speedUnit)} from ${current.cardinal}"
          />
          <!-- Time tick marks -->
          <div class="slider-ticks" aria-hidden="true">
            ${this.renderTicks()}
          </div>
        </div>

        <!-- Stepper and Control Buttons -->
        <div class="scrubber-actions-row">
          <div class="step-btn-group">
            <button type="button" class="btn btn-secondary step-btn" id="${p}step-minus-fast" data-step="-${fastStepHours}" title="Rewind ${fastStepHours} hours" aria-label="Rewind ${fastStepHours} hours">
              « -${fastStepLabel}
            </button>
            <button type="button" class="btn btn-secondary step-btn" id="${p}step-minus-1h" title="Rewind 1 hour (Arrow Left)" aria-label="Rewind 1 hour">
              ‹ -1h
            </button>
            <button type="button" class="btn btn-outline step-btn now-btn" id="${p}step-now-btn" title="Jump to current hour">
              Now
            </button>
            <button type="button" class="btn btn-secondary step-btn" id="${p}step-plus-1h" title="Forward 1 hour (Arrow Right)" aria-label="Forward 1 hour">
              +1h ›
            </button>
            <button type="button" class="btn btn-secondary step-btn" id="${p}step-plus-fast" data-step="${fastStepHours}" title="Forward ${fastStepHours} hours" aria-label="Forward ${fastStepHours} hours">
              +${fastStepLabel} »
            </button>
          </div>

          <button type="button" class="btn btn-secondary play-btn" id="${p}play-scrub-btn" title="Automatically play through gust forecast (Spacebar)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <span>Play Loop</span>
          </button>
        </div>
      </section>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    const p = this.idPrefix;
    const isMultiDay = this.hours.length > 72 || this.isExtended;
    const fastStepHours = isMultiDay ? 24 : 6;

    const slider = this.container.querySelector<HTMLInputElement>(`#${p}time-range-slider`);
    slider?.addEventListener('input', () => {
      this.selectedIndex = parseInt(slider.value, 10);
      this.updateUI();
      this.callbacks.onHourSelect(this.selectedIndex);
    });

    this.container.querySelector(`#${p}step-minus-1h`)?.addEventListener('click', () => this.stepBy(-1));
    this.container.querySelector(`#${p}step-plus-1h`)?.addEventListener('click', () => this.stepBy(1));
    this.container.querySelector(`#${p}step-minus-fast`)?.addEventListener('click', () => this.stepBy(-fastStepHours));
    this.container.querySelector(`#${p}step-plus-fast`)?.addEventListener('click', () => this.stepBy(fastStepHours));

    this.container.querySelector(`#${p}step-now-btn`)?.addEventListener('click', () => {
      const nowIdx = this.hours.findIndex(h => h.isCurrentHour);
      this.setSelectedIndex(nowIdx !== -1 ? nowIdx : 0);
      this.callbacks.onHourSelect(this.selectedIndex);
    });

    this.container.querySelector(`#${p}play-scrub-btn`)?.addEventListener('click', () => {
      this.togglePlay();
    });
  }

  private stepBy(delta: number): void {
    const next = Math.max(0, Math.min(this.hours.length - 1, this.selectedIndex + delta));
    if (next !== this.selectedIndex) {
      this.selectedIndex = next;
      this.updateUI();
      this.callbacks.onHourSelect(this.selectedIndex);
    }
  }

  private updateUI(): void {
    const current = this.hours[this.selectedIndex];
    if (!current) return;

    const p = this.idPrefix;
    const currentIsExtreme = isExtremeGust(current.gustMax);
    const currentColor = getGustIntensityColor(current.gustMax);
    const thumbColor = currentIsExtreme ? 'var(--gust-flash-color, #9333ea)' : currentColor;

    const slider = this.container.querySelector<HTMLInputElement>(`#${p}time-range-slider`);
    if (slider) {
      slider.value = this.selectedIndex.toString();
      slider.style.setProperty('--slider-thumb-color', thumbColor);
      slider.classList.toggle('is-extreme-gust', currentIsExtreme);
      slider.setAttribute('aria-valuenow', this.selectedIndex.toString());
      slider.setAttribute(
        'aria-valuetext',
        `${current.dayLabel} ${current.hourLabel}, Peak Gust ${formatSpeed(current.gustMax, this.speedUnit)} from ${current.cardinal}`
      );
    }

    const timeLabel = this.container.querySelector(`#${p}scrubber-active-time`);
    if (timeLabel) timeLabel.textContent = `${current.dayLabel} at ${current.hourLabel}`;

    const relBadge = this.container.querySelector(`#${p}scrubber-relative-badge`);
    if (relBadge) relBadge.textContent = this.getRelativeLabel(current);

    const speedSpan = this.container.querySelector<HTMLElement>(`#${p}scrubber-quick-speed`);
    if (speedSpan) {
      speedSpan.textContent = `Peak Gust: ${formatSpeed(current.gustMax, this.speedUnit)}`;
      speedSpan.style.setProperty('--quick-gust-color', currentColor);
      speedSpan.classList.toggle('is-extreme-gust', currentIsExtreme);
    }

    const dirSpan = this.container.querySelector(`#${p}scrubber-quick-dir`);
    if (dirSpan) dirSpan.textContent = `${current.cardinal} (${current.directionMean.toFixed(0)}°)`;
  }

  private getRelativeLabel(hour: AggregatedHour): string {
    const diffMs = hour.date.getTime() - new Date().getTime();
    const diffHours = Math.round(diffMs / (3600 * 1000));
    if (Math.abs(diffHours) === 0) return 'Now';
    if (diffHours > 0) {
      if (diffHours >= 48) {
        const days = Math.floor(diffHours / 24);
        const remHours = diffHours % 24;
        return remHours > 0 ? `In ${days}d ${remHours}h` : `In ${days}d`;
      }
      return `In ${diffHours}h`;
    }
    return `${Math.abs(diffHours)}h ago`;
  }
}

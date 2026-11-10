import { AggregatedHour, SpeedUnit } from '../types';
import { formatSpeed } from '../utils/units';

export interface TimeScrubberCallbacks {
  onHourSelect: (index: number) => void;
}

export class TimeScrubber {
  private container: HTMLElement;
  private hours: AggregatedHour[] = [];
  private selectedIndex = 0;
  private speedUnit: SpeedUnit = 'kmh';
  private isPlaying = false;
  private playIntervalId: ReturnType<typeof setInterval> | null = null;
  private callbacks: TimeScrubberCallbacks;

  constructor(container: HTMLElement, callbacks: TimeScrubberCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
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
      const playBtn = this.container.querySelector<HTMLButtonElement>('#play-scrub-btn');
      if (playBtn) {
        playBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
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
      const playBtn = this.container.querySelector<HTMLButtonElement>('#play-scrub-btn');
      if (playBtn) {
        playBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
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
      }, 700);
    }
  }

  private render(): void {
    if (this.hours.length === 0) {
      this.container.innerHTML = '';
      return;
    }

    const current = this.hours[this.selectedIndex] || this.hours[0];
    const maxIdx = this.hours.length - 1;

    this.container.innerHTML = `
      <section class="time-scrubber-section" aria-label="48-Hour Time Navigation and Gust Scrubber">
        <!-- Time status row -->
        <div class="scrubber-header-row">
          <div class="time-status-pill">
            <span class="pulse-indicator ${current.isCurrentHour ? 'active' : ''}"></span>
            <span class="active-time-label" id="scrubber-active-time">${current.dayLabel} at ${current.hourLabel}</span>
            <span class="relative-time-badge" id="scrubber-relative-badge">${this.getRelativeLabel(current)}</span>
          </div>

          <div class="scrubber-quick-stats">
            <span class="quick-speed" id="scrubber-quick-speed">Peak Gust: ${formatSpeed(current.gustMax, this.speedUnit)}</span>
            <span class="quick-dir" id="scrubber-quick-dir">${current.cardinal} (${current.directionMean.toFixed(0)}°)</span>
          </div>
        </div>

        <!-- Slider Bar -->
        <div class="slider-wrapper">
          <label for="time-range-slider" class="visually-hidden">Scrub through 48 hour gust predictions</label>
          <input
            type="range"
            id="time-range-slider"
            class="time-range-slider"
            min="0"
            max="${maxIdx}"
            value="${this.selectedIndex}"
            step="1"
            aria-valuemin="0"
            aria-valuemax="${maxIdx}"
            aria-valuenow="${this.selectedIndex}"
            aria-valuetext="${current.dayLabel} ${current.hourLabel}, Peak Gust ${formatSpeed(current.gustMax, this.speedUnit)} from ${current.cardinal}"
          />
          <!-- Time tick marks -->
          <div class="slider-ticks" aria-hidden="true">
            ${this.hours.map((h, i) => {
              if (i % 6 === 0 || i === maxIdx) {
                return `
                  <div class="tick-mark" style="left: ${(i / maxIdx) * 100}%">
                    <span class="tick-line"></span>
                    <span class="tick-label">${h.hourLabel}</span>
                  </div>
                `;
              }
              return '';
            }).join('')}
          </div>
        </div>

        <!-- Stepper and Control Buttons -->
        <div class="scrubber-actions-row">
          <div class="step-btn-group">
            <button type="button" class="btn btn-secondary step-btn" id="step-minus-6h" title="Rewind 6 hours" aria-label="Rewind 6 hours">
              « -6h
            </button>
            <button type="button" class="btn btn-secondary step-btn" id="step-minus-1h" title="Rewind 1 hour (Arrow Left)" aria-label="Rewind 1 hour">
              ‹ -1h
            </button>
            <button type="button" class="btn btn-outline step-btn now-btn" id="step-now-btn" title="Jump to current hour">
              Now
            </button>
            <button type="button" class="btn btn-secondary step-btn" id="step-plus-1h" title="Forward 1 hour (Arrow Right)" aria-label="Forward 1 hour">
              +1h ›
            </button>
            <button type="button" class="btn btn-secondary step-btn" id="step-plus-6h" title="Forward 6 hours" aria-label="Forward 6 hours">
              +6h »
            </button>
          </div>

          <button type="button" class="btn btn-secondary play-btn" id="play-scrub-btn" title="Automatically play through gust forecast (Spacebar)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
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
    const slider = this.container.querySelector<HTMLInputElement>('#time-range-slider');
    slider?.addEventListener('input', () => {
      this.selectedIndex = parseInt(slider.value, 10);
      this.updateUI();
      this.callbacks.onHourSelect(this.selectedIndex);
    });

    this.container.querySelector('#step-minus-1h')?.addEventListener('click', () => this.stepBy(-1));
    this.container.querySelector('#step-plus-1h')?.addEventListener('click', () => this.stepBy(1));
    this.container.querySelector('#step-minus-6h')?.addEventListener('click', () => this.stepBy(-6));
    this.container.querySelector('#step-plus-6h')?.addEventListener('click', () => this.stepBy(6));

    this.container.querySelector('#step-now-btn')?.addEventListener('click', () => {
      const nowIdx = this.hours.findIndex(h => h.isCurrentHour);
      this.setSelectedIndex(nowIdx !== -1 ? nowIdx : 0);
      this.callbacks.onHourSelect(this.selectedIndex);
    });

    this.container.querySelector('#play-scrub-btn')?.addEventListener('click', () => {
      this.togglePlay();
    });

    // Keyboard support
    document.addEventListener('keydown', (e) => {
      if (document.activeElement?.tagName === 'INPUT' && (document.activeElement as HTMLElement).id !== 'time-range-slider') {
        return; // ignore when typing in search box
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.stepBy(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.stepBy(1);
      } else if (e.key === ' ' && document.activeElement?.tagName !== 'BUTTON') {
        e.preventDefault();
        this.togglePlay();
      }
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

    const slider = this.container.querySelector<HTMLInputElement>('#time-range-slider');
    if (slider) {
      slider.value = this.selectedIndex.toString();
      slider.setAttribute('aria-valuenow', this.selectedIndex.toString());
      slider.setAttribute(
        'aria-valuetext',
        `${current.dayLabel} ${current.hourLabel}, Peak Gust ${formatSpeed(current.gustMax, this.speedUnit)} from ${current.cardinal}`
      );
    }

    const timeLabel = this.container.querySelector('#scrubber-active-time');
    if (timeLabel) timeLabel.textContent = `${current.dayLabel} at ${current.hourLabel}`;

    const relBadge = this.container.querySelector('#scrubber-relative-badge');
    if (relBadge) relBadge.textContent = this.getRelativeLabel(current);

    const speedSpan = this.container.querySelector('#scrubber-quick-speed');
    if (speedSpan) speedSpan.textContent = `Peak Gust: ${formatSpeed(current.gustMax, this.speedUnit)}`;

    const dirSpan = this.container.querySelector('#scrubber-quick-dir');
    if (dirSpan) dirSpan.textContent = `${current.cardinal} (${current.directionMean.toFixed(0)}°)`;
  }

  private getRelativeLabel(hour: AggregatedHour): string {
    const diffMs = hour.date.getTime() - new Date().getTime();
    const diffHours = Math.round(diffMs / (3600 * 1000));
    if (Math.abs(diffHours) === 0) return 'Now';
    if (diffHours > 0) return `In ${diffHours}h`;
    return `${Math.abs(diffHours)}h ago`;
  }
}

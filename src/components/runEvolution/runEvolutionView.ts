import { RunEvolutionResult, SpeedUnit, ModelId } from '../../types';
import { EVOLUTION_MODELS, EvolutionModelOption } from '../../api/runEvolution';
import { RunEvolutionChart } from './runEvolutionChart';
import { renderRunEvolutionCards } from './runEvolutionCards';
import { renderRunEvolutionTable } from './runEvolutionTable';

export interface RunEvolutionViewCallbacks {
  onModelChange: (model: ModelId) => void;
  onRefresh: () => void;
}

export class RunEvolutionView {
  private container: HTMLElement;
  private result: RunEvolutionResult | null = null;
  private currentModel: ModelId = 'ecmwf_ifs025';
  private selectedTime: string | null = null;
  private speedUnit: SpeedUnit = 'kmh';
  private activeRunIds: Set<string> = new Set();
  private callbacks: RunEvolutionViewCallbacks;
  private chart: RunEvolutionChart | null = null;
  private isLoading = false;

  constructor(container: HTMLElement, callbacks: RunEvolutionViewCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.renderSkeleton();
  }

  private renderSkeleton(): void {
    this.container.innerHTML = `
      <div class="evolution-view-wrapper">
        <div class="evolution-control-bar" id="evolution-control-bar"></div>
        <div id="evolution-insights-container"></div>
        <div id="evolution-chart-container"></div>
        <div id="evolution-table-container"></div>
      </div>
    `;

    const chartContainer = this.container.querySelector<HTMLElement>('#evolution-chart-container')!;
    this.chart = new RunEvolutionChart(chartContainer, {
      onHourSelect: (targetTime) => this.selectTargetTime(targetTime)
    });
  }

  public update(
    result: RunEvolutionResult | null,
    currentModel: ModelId,
    speedUnit: SpeedUnit,
    isLoading: boolean
  ): void {
    this.result = result;
    this.currentModel = currentModel;
    this.speedUnit = speedUnit;
    this.isLoading = isLoading;

    if (result) {
      // If active runs not initialized or model changed, enable all runs
      if (this.activeRunIds.size === 0) {
        result.runs.forEach(r => this.activeRunIds.add(r.runId));
      }
      // If selectedTime is null or not in timeline, pick the peak time of latest run or first peak
      if (!this.selectedTime || !result.timeline.includes(this.selectedTime)) {
        this.selectedTime = result.runs[0]?.peakGustTime || result.timeline[0] || null;
      }
    }

    this.renderControlBar();
    this.renderContent();
  }

  public selectTargetTime(time: string | null): void {
    this.selectedTime = time;
    if (this.chart) {
      this.chart.setSelectedTime(time);
    }
    this.renderCardsAndTable();
  }

  private renderControlBar(): void {
    const barEl = this.container.querySelector<HTMLElement>('#evolution-control-bar');
    if (!barEl) return;

    const modelButtonsHtml = EVOLUTION_MODELS.map(m => {
      const active = m.id === this.currentModel;
      return `
        <button
          type="button"
          class="btn ${active ? 'btn-primary' : 'btn-outline'} btn-sm model-tab-btn"
          data-model-id="${m.id}"
          aria-pressed="${active}"
        >
          ${m.name} <small class="model-res">(${m.resolution})</small>
        </button>
      `;
    }).join('');

    barEl.innerHTML = `
      <div class="evolution-bar-left">
        <span class="evolution-bar-label">Compare Model Runs:</span>
        <div class="model-pills-group" role="group" aria-label="Select forecast model for run evolution">
          ${modelButtonsHtml}
        </div>
      </div>
      <div class="evolution-bar-right">
        <button type="button" class="btn btn-outline btn-sm" id="evolution-refresh-btn" ${this.isLoading ? 'disabled' : ''}>
          ${this.isLoading ? '⟳ Fetching Runs...' : '↻ Refresh Runs'}
        </button>
      </div>
    `;

    barEl.querySelectorAll<HTMLButtonElement>('.model-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mId = btn.getAttribute('data-model-id') as ModelId;
        if (mId && mId !== this.currentModel) {
          this.activeRunIds.clear(); // Reset to enable all runs of the new model
          this.callbacks.onModelChange(mId);
        }
      });
    });

    barEl.querySelector('#evolution-refresh-btn')?.addEventListener('click', () => {
      this.callbacks.onRefresh();
    });
  }

  private renderContent(): void {
    if (this.isLoading && !this.result) {
      const insightsContainer = this.container.querySelector<HTMLElement>('#evolution-insights-container');
      if (insightsContainer) {
        insightsContainer.innerHTML = `
          <div class="loading-state-card">
            <div class="spinner"></div>
            <p>Fetching consecutive model runs from Open-Meteo Single Runs API...</p>
          </div>
        `;
      }
      return;
    }

    if (!this.result) return;

    if (this.chart) {
      this.chart.update(this.result, this.activeRunIds, this.selectedTime, this.speedUnit);
    }

    this.renderCardsAndTable();
  }

  private renderCardsAndTable(): void {
    if (!this.result) return;

    const insightsContainer = this.container.querySelector<HTMLElement>('#evolution-insights-container');
    if (insightsContainer) {
      renderRunEvolutionCards(insightsContainer, this.result, this.selectedTime, this.speedUnit);
    }

    const tableContainer = this.container.querySelector<HTMLElement>('#evolution-table-container');
    if (tableContainer) {
      renderRunEvolutionTable(
        tableContainer,
        this.result,
        this.selectedTime,
        this.speedUnit,
        this.activeRunIds,
        {
          onHourSelect: (targetTime) => this.selectTargetTime(targetTime)
        }
      );
    }
  }
}

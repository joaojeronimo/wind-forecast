import { describe, it, expect, beforeEach } from 'vitest';
import { generateDemoRunEvolution } from '../../api/runEvolution';
import { renderRunEvolutionCards } from './runEvolutionCards';
import { renderRunEvolutionTable } from './runEvolutionTable';

describe('Run Evolution Components', () => {
  function createMockContainer(): HTMLElement {
    const listeners = new Map<string, Function[]>();
    const container = {
      innerHTML: '',
      querySelectorAll: (selector: string) => {
        // Return dummy matching elements if needed
        return [];
      },
      querySelector: (selector: string) => null,
      addEventListener: (evt: string, fn: Function) => {
        if (!listeners.has(evt)) listeners.set(evt, []);
        listeners.get(evt)!.push(fn);
      }
    } as unknown as HTMLElement;
    return container;
  }

  it('renders run evolution cards with trend badges and peak progression', () => {
    const container = createMockContainer();
    const demo = generateDemoRunEvolution(38.9634, -9.4167, 'Ericeira', 'ecmwf_ifs025', 5);
    renderRunEvolutionCards(container, demo, demo.timeline[10], 'kmh');

    expect(container.innerHTML).toContain('Latest Model Run');
    expect(container.innerHTML).toContain('Run-over-Run Trend');
    expect(container.innerHTML).toContain('Forecast Volatility Spread');
    expect(container.innerHTML).toContain('Peak Gust Trajectory Across Runs');
    expect(container.innerHTML).toContain('Evolution For Target Hour:');
    expect(container.innerHTML).toContain('progression-step');
  });

  it('renders run evolution comparison table with all active runs and deltas', () => {
    const container = createMockContainer();
    const demo = generateDemoRunEvolution(38.9634, -9.4167, 'Ericeira', 'ecmwf_ifs025', 5);
    const activeRuns = new Set(demo.runs.map(r => r.runId));

    renderRunEvolutionTable(
      container,
      demo,
      demo.timeline[5],
      'kmh',
      activeRuns,
      {
        onHourSelect: () => {}
      }
    );

    expect(container.innerHTML).toContain('Run-by-Run Timeline Comparison');
    expect(container.innerHTML).toContain('forecast-row');
    expect(container.innerHTML).toContain('table-delta-badge');
  });
});

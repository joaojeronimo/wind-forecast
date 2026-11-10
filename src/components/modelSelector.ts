import { ModelId } from '../types';
import { AVAILABLE_MODELS } from '../api/openMeteo';

export interface ModelSelectorCallbacks {
  onModelsChanged: (activeModels: ModelId[]) => void;
}

export function renderModelSelector(
  container: HTMLElement,
  activeModels: ModelId[],
  callbacks: ModelSelectorCallbacks
): void {
  const activeSet = new Set(activeModels);

  container.innerHTML = `
    <section class="model-selector-section" aria-label="Prediction Models Selection">
      <div class="model-selector-header">
        <h3 class="model-selector-title">Ensemble Forecast Models (${activeModels.length}/${AVAILABLE_MODELS.length} Active)</h3>
        <div class="model-selector-actions">
          <button type="button" class="btn btn-outline btn-xs" id="models-select-all-btn">Select All</button>
          <button type="button" class="btn btn-outline btn-xs" id="models-global-top3-btn">Top 3 (ECMWF, GFS, ICON)</button>
        </div>
      </div>
      <div class="models-grid">
        ${AVAILABLE_MODELS.map(m => {
          const isChecked = activeSet.has(m.id);
          return `
            <label class="model-checkbox-label ${isChecked ? 'checked' : ''}" style="border-left: 3px solid ${m.color};">
              <input
                type="checkbox"
                class="model-checkbox"
                data-model-id="${m.id}"
                ${isChecked ? 'checked' : ''}
              />
              <div class="model-label-content">
                <span class="model-label-name" style="color: ${m.color};">${m.name}</span>
                <span class="model-label-agency">${m.agency} • ${m.resolution}</span>
              </div>
            </label>
          `;
        }).join('')}
      </div>
    </section>
  `;

  // Attach change listeners
  container.querySelectorAll<HTMLInputElement>('.model-checkbox').forEach(input => {
    input.addEventListener('change', () => {
      const selected: ModelId[] = [];
      container.querySelectorAll<HTMLInputElement>('.model-checkbox:checked').forEach(checked => {
        const id = checked.getAttribute('data-model-id') as ModelId;
        if (id) selected.push(id);
      });

      if (selected.length === 0) {
        // Must keep at least one
        input.checked = true;
        return;
      }

      callbacks.onModelsChanged(selected);
    });
  });

  container.querySelector('#models-select-all-btn')?.addEventListener('click', () => {
    const all = AVAILABLE_MODELS.map(m => m.id);
    callbacks.onModelsChanged(all);
  });

  container.querySelector('#models-global-top3-btn')?.addEventListener('click', () => {
    const top3: ModelId[] = ['ecmwf_ifs025', 'gfs_seamless', 'icon_seamless'];
    callbacks.onModelsChanged(top3);
  });
}

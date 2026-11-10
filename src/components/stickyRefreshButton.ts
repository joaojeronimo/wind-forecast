export interface StickyRefreshButtonCallbacks {
  onRefresh: () => void;
}

export function renderStickyRefreshButton(
  container: HTMLElement,
  isLoading: boolean,
  isCached: boolean,
  callbacks: StickyRefreshButtonCallbacks
): void {
  const cachedBadge = isCached
    ? `<span class="sticky-cache-badge" title="Data served from 15-minute cache">Cached</span>`
    : '';

  container.innerHTML = `
    <button
      type="button"
      class="sticky-refresh-btn ${isLoading ? 'loading' : ''} ${isCached ? 'is-cached' : ''}"
      id="sticky-refresh-btn"
      title="Delete cache and fetch fresh forecast from Open-Meteo"
      aria-label="Refresh data (clears cache and fetches fresh data)${isCached ? ' - currently showing cached data' : ''}"
      ${isLoading ? 'disabled aria-busy="true"' : 'aria-busy="false"'}
    >
      <svg
        class="sticky-refresh-icon ${isLoading ? 'spin' : ''}"
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
      </svg>
      <span class="sticky-refresh-label">${isLoading ? 'Refreshing...' : 'Refresh Data'}</span>
      ${cachedBadge}
    </button>
  `;

  const btn = container.querySelector<HTMLButtonElement>('#sticky-refresh-btn');
  if (btn && !isLoading) {
    btn.addEventListener('click', () => {
      callbacks.onRefresh();
    });
  }
}

import { AggregatedHour } from '../types';

/**
 * Finds the index in the new forecast hours that best matches the previously selected hour,
 * ensuring the user's selection is preserved across data refreshes.
 *
 * 1. Checks for exact ISO time string match (e.g. "2026-11-10T14:00").
 * 2. Falls back to matching by Date timestamp (epoch ms).
 * 3. Falls back to the closest hour within 60 minutes (useful for minor offset/rounding differences).
 * 4. If none match (e.g. initial load or the selected hour fell out of the 48h forecast window),
 *    falls back to the current hour (isCurrentHour) or 0.
 */
export function findRestoredSelectionIndex(
  hours: AggregatedHour[],
  prevSelectedTime?: string,
  prevSelectedTimestamp?: number
): number {
  if (hours.length === 0) {
    return 0;
  }

  // 1. Exact time string match
  if (prevSelectedTime !== undefined) {
    const timeIdx = hours.findIndex(h => h.time === prevSelectedTime);
    if (timeIdx !== -1) {
      return timeIdx;
    }
  }

  // 2. Timestamp exact match
  if (prevSelectedTimestamp !== undefined && !isNaN(prevSelectedTimestamp)) {
    const timestampIdx = hours.findIndex(h => h.date.getTime() === prevSelectedTimestamp);
    if (timestampIdx !== -1) {
      return timestampIdx;
    }

    // 3. Closest hour within 60 minutes
    const closestIdx = hours.findIndex(
      h => Math.abs(h.date.getTime() - prevSelectedTimestamp) < 60 * 60 * 1000
    );
    if (closestIdx !== -1) {
      return closestIdx;
    }
  }

  // 4. Default fallback: current hour or first hour
  const curIdx = hours.findIndex(h => h.isCurrentHour);
  return curIdx >= 0 ? curIdx : 0;
}

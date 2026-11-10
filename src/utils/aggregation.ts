import {
  ModelId,
  ModelDataPoint,
  AggregatedHour,
  ConsensusRating
} from '../types';
import { getBeaufort } from './beaufort';

export const CARDINAL_DIRECTIONS = [
  'N', 'NNE', 'NE', 'ENE',
  'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW',
  'W', 'WNW', 'NW', 'NNW'
] as const;

/**
 * Converts a wind direction angle in degrees (0-360) to a 16-point compass cardinal string.
 */
export function degreesToCardinal(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return CARDINAL_DIRECTIONS[index];
}

/**
 * Calculates true meteorological circular / vector average of wind directions.
 * Handles the 359° / 1° wrap-around correctly.
 */
export function calculateVectorWindDirection(
  directions: number[],
  speeds?: number[]
): { meanDirection: number; angularSpread: number } {
  if (directions.length === 0) {
    return { meanDirection: 0, angularSpread: 0 };
  }

  let sumSin = 0;
  let sumCos = 0;
  const n = directions.length;

  for (let i = 0; i < n; i++) {
    const rad = (directions[i] * Math.PI) / 180;
    const weight = speeds && speeds[i] !== undefined && !isNaN(speeds[i]) ? Math.max(0.1, speeds[i]) : 1;
    sumSin += weight * Math.sin(rad);
    sumCos += weight * Math.cos(rad);
  }

  // Circular mean direction
  let meanRad = Math.atan2(sumSin, sumCos);
  let meanDeg = (meanRad * 180) / Math.PI;
  meanDeg = ((meanDeg % 360) + 360) % 360;

  // Circular dispersion / spread (Yamartino / circular standard deviation)
  let unitSin = 0;
  let unitCos = 0;
  for (let i = 0; i < n; i++) {
    const rad = (directions[i] * Math.PI) / 180;
    unitSin += Math.sin(rad);
    unitCos += Math.cos(rad);
  }
  const r = Math.sqrt(unitSin * unitSin + unitCos * unitCos) / n;
  const clampedR = Math.min(1, Math.max(0.0001, r));
  // Circular standard deviation in degrees
  const angularSpread = Math.min(180, Math.sqrt(-2 * Math.log(clampedR)) * (180 / Math.PI));

  return {
    meanDirection: Math.round(meanDeg * 10) / 10,
    angularSpread: Math.round(angularSpread * 10) / 10
  };
}

/**
 * Computes median value of an array of numbers.
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Computes arithmetic mean.
 */
export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Computes sample standard deviation.
 */
export function calculateStdDev(values: number[], mean: number): number {
  if (values.length <= 1) return 0;
  const sumSq = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0);
  return Math.sqrt(sumSq / (values.length - 1));
}

/**
 * Determines consensus level across models based on wind speed standard deviation and spread.
 */
export function evaluateConsensus(speedStdDev: number, directionSpread: number): ConsensusRating {
  // speedStdDev in km/h (< 3 km/h is ~1.6 kts -> high agreement)
  if (speedStdDev <= 3.5 && directionSpread <= 25) {
    return 'high';
  } else if (speedStdDev <= 7.0 && directionSpread <= 50) {
    return 'moderate';
  } else {
    return 'divergent';
  }
}

/**
 * Aggregates model predictions for a single hour.
 */
export function aggregateHour(
  timeStr: string,
  modelMap: Partial<Record<ModelId, ModelDataPoint>>,
  activeModelIds: ModelId[]
): AggregatedHour {
  const date = new Date(timeStr);
  const hourLabel = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const dayLabel = date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  // Gather values from models that are active and have valid numeric values
  const speeds: number[] = [];
  const directions: number[] = [];
  const gusts: number[] = [];
  const temps: number[] = [];

  for (const id of activeModelIds) {
    const point = modelMap[id];
    if (point && !isNaN(point.speed) && point.speed !== null) {
      speeds.push(point.speed);
      directions.push(point.direction);
      if (point.gust !== undefined && !isNaN(point.gust) && point.gust !== null) {
        gusts.push(point.gust);
      }
      if (point.temperature !== undefined && !isNaN(point.temperature) && point.temperature !== null) {
        temps.push(point.temperature);
      }
    }
  }

  // Calculate speed aggregates
  const speedMean = speeds.length > 0 ? calculateMean(speeds) : 0;
  const speedMedian = speeds.length > 0 ? calculateMedian(speeds) : 0;
  const speedMin = speeds.length > 0 ? Math.min(...speeds) : 0;
  const speedMax = speeds.length > 0 ? Math.max(...speeds) : 0;
  const speedStdDev = speeds.length > 1 ? calculateStdDev(speeds, speedMean) : 0;

  // Calculate direction aggregates
  const { meanDirection, angularSpread } = calculateVectorWindDirection(directions, speeds);
  const cardinal = degreesToCardinal(meanDirection);

  // Gusts
  const gustMax = gusts.length > 0 ? Math.max(...gusts) : speedMax;
  const gustMean = gusts.length > 0 ? calculateMean(gusts) : speedMean;

  // Temperature
  const tempMean = temps.length > 0 ? calculateMean(temps) : 20;
  const tempMin = temps.length > 0 ? Math.min(...temps) : tempMean;
  const tempMax = temps.length > 0 ? Math.max(...temps) : tempMean;

  const beaufort = getBeaufort(speedMean);
  const consensus = evaluateConsensus(speedStdDev, angularSpread);

  // Check if this matches current real-world hour (within 30 mins)
  const now = new Date();
  const isCurrentHour = Math.abs(date.getTime() - now.getTime()) < 30 * 60 * 1000;

  return {
    time: timeStr,
    date,
    hourLabel,
    dayLabel,
    isCurrentHour,
    speedMean: Math.round(speedMean * 10) / 10,
    speedMedian: Math.round(speedMedian * 10) / 10,
    speedMin: Math.round(speedMin * 10) / 10,
    speedMax: Math.round(speedMax * 10) / 10,
    speedStdDev: Math.round(speedStdDev * 10) / 10,
    directionMean: meanDirection,
    directionSpread: angularSpread,
    cardinal,
    gustMax: Math.round(gustMax * 10) / 10,
    gustMean: Math.round(gustMean * 10) / 10,
    tempMean: Math.round(tempMean * 10) / 10,
    tempMin: Math.round(tempMin * 10) / 10,
    tempMax: Math.round(tempMax * 10) / 10,
    beaufort,
    consensus,
    reportingModelsCount: speeds.length,
    modelValues: modelMap
  };
}

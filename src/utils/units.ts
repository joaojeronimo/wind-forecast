import { SpeedUnit, TempUnit } from '../types';

export const KMH_TO_KNOTS = 0.539957;
export const KMH_TO_MS = 0.277778;
export const KMH_TO_MPH = 0.621371;

/**
 * Convert wind speed from base unit (km/h) to target unit
 */
export function convertSpeed(kmh: number, unit: SpeedUnit): number {
  if (isNaN(kmh) || kmh < 0) return 0;
  switch (unit) {
    case 'knots':
      return kmh * KMH_TO_KNOTS;
    case 'ms':
      return kmh * KMH_TO_MS;
    case 'mph':
      return kmh * KMH_TO_MPH;
    case 'kmh':
    default:
      return kmh;
  }
}

/**
 * Format speed with decimal places and unit suffix
 */
export function formatSpeed(kmh: number, unit: SpeedUnit, precision = 1): string {
  const converted = convertSpeed(kmh, unit);
  return `${converted.toFixed(precision)} ${getSpeedUnitLabel(unit)}`;
}

export function getSpeedUnitLabel(unit: SpeedUnit): string {
  switch (unit) {
    case 'knots':
      return 'kts';
    case 'ms':
      return 'm/s';
    case 'mph':
      return 'mph';
    case 'kmh':
    default:
      return 'km/h';
  }
}

/**
 * Convert temperature from Celsius to target unit
 */
export function convertTemp(celsius: number, unit: TempUnit): number {
  if (isNaN(celsius)) return 0;
  switch (unit) {
    case 'fahrenheit':
      return celsius * 1.8 + 32;
    case 'celsius':
    default:
      return celsius;
  }
}

export function formatTemp(celsius: number, unit: TempUnit, precision = 0): string {
  const converted = convertTemp(celsius, unit);
  const suffix = unit === 'fahrenheit' ? '°F' : '°C';
  return `${converted.toFixed(precision)}${suffix}`;
}

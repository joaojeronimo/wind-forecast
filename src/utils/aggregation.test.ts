import { describe, it, expect } from 'vitest';
import {
  calculateVectorWindDirection,
  degreesToCardinal,
  calculateMean,
  calculateMedian,
  aggregateHour
} from './aggregation';
import { convertSpeed, convertTemp, formatSpeed, getSpeedUnitLabel } from './units';

describe('Wind Direction Vector Math', () => {
  it('correctly calculates vector average across the 360/0 degree boundary', () => {
    // 350 deg (NNW) and 10 deg (NNE) with equal gusts should average to 0 / 360 deg (North), NOT 180 deg (South)!
    const res = calculateVectorWindDirection([350, 10], [35, 35]);
    expect(res.meanDirection === 0 || res.meanDirection === 360).toBe(true);
    expect(res.angularSpread).toBeLessThan(20);
  });

  it('correctly converts degrees to 16-point cardinal directions', () => {
    expect(degreesToCardinal(0)).toBe('N');
    expect(degreesToCardinal(360)).toBe('N');
    expect(degreesToCardinal(90)).toBe('E');
    expect(degreesToCardinal(180)).toBe('S');
    expect(degreesToCardinal(270)).toBe('W');
    expect(degreesToCardinal(45)).toBe('NE');
    expect(degreesToCardinal(315)).toBe('NW');
  });

  it('computes arithmetic mean and median properly', () => {
    expect(calculateMean([10, 20, 30])).toBe(20);
    expect(calculateMedian([10, 30, 20])).toBe(20);
    expect(calculateMedian([10, 20, 30, 40])).toBe(25);
  });
});

describe('Unit Conversions', () => {
  it('converts km/h to knots properly', () => {
    const knots = convertSpeed(10, 'knots');
    expect(knots).toBeCloseTo(5.399, 1);
  });

  it('keeps base km/h values unchanged', () => {
    expect(convertSpeed(25, 'kmh')).toBe(25);
    expect(formatSpeed(25, 'kmh', 1)).toBe('25.0 km/h');
  });

  it('provides correct speed unit labels', () => {
    expect(getSpeedUnitLabel('kmh')).toBe('km/h');
    expect(getSpeedUnitLabel('knots')).toBe('kts');
    expect(getSpeedUnitLabel('ms')).toBe('m/s');
    expect(getSpeedUnitLabel('mph')).toBe('mph');
  });

  it('converts Celsius to Fahrenheit properly', () => {
    expect(convertTemp(0, 'fahrenheit')).toBe(32);
    expect(convertTemp(20, 'fahrenheit')).toBe(68);
  });
});

describe('aggregateHour for Gusts', () => {
  it('aggregates multi-model gust predictions properly', () => {
    const hour = aggregateHour(
      '2026-11-10T14:00:00Z',
      {
        best_match: { gust: 35, speed: 25, direction: 340, temperature: 18 },
        ecmwf_ifs025: { gust: 38, speed: 27, direction: 345, temperature: 18 },
        gfs_seamless: { gust: 33, speed: 24, direction: 335, temperature: 19 }
      },
      ['best_match', 'ecmwf_ifs025', 'gfs_seamless']
    );

    expect(hour.reportingModelsCount).toBe(3);
    expect(hour.gustMean).toBeCloseTo(35.3, 1);
    expect(hour.gustMin).toBe(33);
    expect(hour.gustMax).toBe(38);
    expect(hour.cardinal).toBe('NNW');
    expect(hour.consensus).toBe('high');
  });
});

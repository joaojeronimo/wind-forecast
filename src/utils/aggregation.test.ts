import { describe, it, expect } from 'vitest';
import {
  calculateVectorWindDirection,
  degreesToCardinal,
  calculateMean,
  calculateMedian,
  aggregateHour
} from './aggregation';
import { convertSpeed, convertTemp } from './units';

describe('Wind Direction Vector Math', () => {
  it('correctly calculates vector average across the 360/0 degree boundary', () => {
    // 350 deg (NNW) and 10 deg (NNE) with equal speeds should average to 0 / 360 deg (North), NOT 180 deg (South)!
    const res = calculateVectorWindDirection([350, 10], [20, 20]);
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
    // 10 km/h is ~ 5.4 knots
    const knots = convertSpeed(10, 'knots');
    expect(knots).toBeCloseTo(5.399, 1);
  });

  it('converts Celsius to Fahrenheit properly', () => {
    expect(convertTemp(0, 'fahrenheit')).toBe(32);
    expect(convertTemp(20, 'fahrenheit')).toBe(68);
  });
});

describe('aggregateHour', () => {
  it('aggregates multi-model hour data properly', () => {
    const hour = aggregateHour(
      '2026-11-10T14:00:00Z',
      {
        best_match: { speed: 25, direction: 340, gust: 35, temperature: 18 },
        ecmwf_ifs025: { speed: 27, direction: 345, gust: 38, temperature: 18 },
        gfs_seamless: { speed: 24, direction: 335, gust: 33, temperature: 19 }
      },
      ['best_match', 'ecmwf_ifs025', 'gfs_seamless']
    );

    expect(hour.reportingModelsCount).toBe(3);
    expect(hour.speedMean).toBeCloseTo(25.3, 1);
    expect(hour.speedMin).toBe(24);
    expect(hour.speedMax).toBe(27);
    expect(hour.cardinal).toBe('NNW');
    expect(hour.gustMax).toBe(38);
    expect(hour.consensus).toBe('high');
  });
});

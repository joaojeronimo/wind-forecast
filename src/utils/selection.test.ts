import { describe, it, expect } from 'vitest';
import { findRestoredSelectionIndex } from './selection';
import { AggregatedHour } from '../types';

function createMockHour(timeStr: string, isCurrentHour = false): AggregatedHour {
  const date = new Date(timeStr);
  return {
    time: timeStr,
    date,
    hourLabel: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    dayLabel: date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
    isCurrentHour,
    gustMax: 25,
    gustMean: 20,
    gustMedian: 20,
    gustMin: 15,
    gustStdDev: 2,
    speedMean: 18,
    directionMean: 320,
    directionSpread: 10,
    cardinal: 'NW',
    tempMean: 18,
    tempMin: 16,
    tempMax: 20,
    beaufort: {
      number: 5,
      label: 'Fresh Breeze',
      color: '#06b6d4',
      description: 'Moderate breeze',
      seaConditions: 'Moderate waves'
    },
    consensus: 'high',
    reportingModelsCount: 5,
    modelValues: {}
  };
}

describe('findRestoredSelectionIndex', () => {
  const hours: AggregatedHour[] = [
    createMockHour('2026-11-10T10:00:00Z', false),
    createMockHour('2026-11-10T11:00:00Z', true), // current hour at index 1
    createMockHour('2026-11-10T12:00:00Z', false),
    createMockHour('2026-11-10T13:00:00Z', false),
    createMockHour('2026-11-10T14:00:00Z', false)
  ];

  it('returns 0 if hours array is empty', () => {
    expect(findRestoredSelectionIndex([])).toBe(0);
    expect(findRestoredSelectionIndex([], '2026-11-10T12:00:00Z')).toBe(0);
  });

  it('restores selection by matching exact ISO time string', () => {
    const selectedTime = '2026-11-10T13:00:00Z';
    const index = findRestoredSelectionIndex(hours, selectedTime);
    expect(index).toBe(3);
  });

  it('restores selection when refreshed list shifts hour positions', () => {
    // When 1 hour passes, the array starts at 11:00 instead of 10:00
    const shiftedHours: AggregatedHour[] = [
      createMockHour('2026-11-10T11:00:00Z', false),
      createMockHour('2026-11-10T12:00:00Z', true),
      createMockHour('2026-11-10T13:00:00Z', false),
      createMockHour('2026-11-10T14:00:00Z', false)
    ];

    // User had selected 13:00 (which was index 3 in old array)
    const selectedTime = '2026-11-10T13:00:00Z';
    const index = findRestoredSelectionIndex(shiftedHours, selectedTime);
    // In shifted array, 13:00 is at index 2
    expect(index).toBe(2);
  });

  it('restores selection by timestamp if string representation differs slightly', () => {
    const timestamp = new Date('2026-11-10T14:00:00Z').getTime();
    // String formatted differently, but timestamp matches
    const index = findRestoredSelectionIndex(hours, 'different-string-format', timestamp);
    expect(index).toBe(4);
  });

  it('finds closest hour within 60 minutes if exact timestamp not found', () => {
    // Timestamp is 12:05 (300,000 ms after 12:00)
    const timestamp = new Date('2026-11-10T12:05:00Z').getTime();
    const index = findRestoredSelectionIndex(hours, undefined, timestamp);
    expect(index).toBe(2); // Matches 12:00
  });

  it('defaults to current hour index if no previous selection provided', () => {
    const index = findRestoredSelectionIndex(hours);
    expect(index).toBe(1); // index 1 has isCurrentHour = true
  });

  it('defaults to current hour if previous selection is out of range', () => {
    const oldTime = '2026-11-08T08:00:00Z'; // 2 days ago
    const oldTimestamp = new Date(oldTime).getTime();
    const index = findRestoredSelectionIndex(hours, oldTime, oldTimestamp);
    expect(index).toBe(1); // falls back to current hour
  });

  it('defaults to 0 if no previous selection and no hour is marked as current', () => {
    const noCurrentHours = [
      createMockHour('2026-11-10T10:00:00Z', false),
      createMockHour('2026-11-10T11:00:00Z', false)
    ];
    const index = findRestoredSelectionIndex(noCurrentHours);
    expect(index).toBe(0);
  });
});

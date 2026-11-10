import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  formatRunIsoUtc,
  formatRunLabels,
  generateDemoRunEvolution,
  EVOLUTION_MODELS
} from './runEvolution';

describe('runEvolution API & utilities', () => {
  it('formats UTC ISO strings for runs correctly', () => {
    const dt = new Date(Date.UTC(2026, 10, 10, 6, 0, 0)); // Nov 10, 2026 06:00 UTC
    expect(formatRunIsoUtc(dt)).toBe('2026-11-10T06:00');
  });

  it('generates clear run labels for latest and older runs', () => {
    const dt = new Date(Date.UTC(2026, 10, 10, 6, 0, 0));
    const latestLabels = formatRunLabels(dt, 0, true);
    expect(latestLabels.relativeLabel).toBe('Latest');
    expect(latestLabels.label).toContain('06:00 UTC (Latest)');
    expect(latestLabels.shortLabel).toBe('10/06Z');

    const olderLabels = formatRunLabels(dt, 12, false);
    expect(olderLabels.relativeLabel).toBe('-12h');
    expect(olderLabels.label).toContain('06:00 UTC (-12h)');
  });

  it('generates demo run evolution data with multiple consecutive runs', () => {
    const demo = generateDemoRunEvolution(38.9634, -9.4167, 'Ericeira', 'ecmwf_ifs025', 5);
    expect(demo.runs.length).toBe(5);
    expect(demo.model).toBe('ecmwf_ifs025');
    expect(demo.runs[0].isLatest).toBe(true);
    expect(demo.runs[1].isLatest).toBe(false);
    expect(demo.runs[0].offsetHours).toBe(0);
    expect(demo.runs[1].offsetHours).toBe(6);
    expect(demo.timeline.length).toBeGreaterThan(24);

    // Verify peak gusts are non-zero and valid
    for (const r of demo.runs) {
      expect(r.peakGust).toBeGreaterThan(0);
      expect(r.hourly.time.length).toBe(72);
      expect(r.hourly.windGusts.length).toBe(72);
    }
  });

  it('provides supported models for run evolution including ECMWF IFS', () => {
    const ids = EVOLUTION_MODELS.map(m => m.id);
    expect(ids).toContain('ecmwf_ifs025');
    expect(ids).toContain('gfs_seamless');
    expect(ids).toContain('icon_seamless');
  });
});

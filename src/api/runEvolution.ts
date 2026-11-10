import {
  ModelId,
  SingleRunInfo,
  RunEvolutionResult
} from '../types';
import {
  getCachedData,
  setCachedData,
  deleteCachedData
} from '../utils/cache';

export interface EvolutionModelOption {
  id: ModelId;
  name: string;
  agency: string;
  resolution: string;
}

export const EVOLUTION_MODELS: EvolutionModelOption[] = [
  { id: 'ecmwf_ifs025', name: 'ECMWF IFS', agency: 'European Centre (ECMWF)', resolution: '25 km' },
  { id: 'gfs_seamless', name: 'GFS Seamless', agency: 'NOAA (USA)', resolution: '13-28 km' },
  { id: 'icon_seamless', name: 'ICON Seamless', agency: 'DWD (Germany)', resolution: '2-13 km' },
  { id: 'gem_seamless', name: 'GEM Seamless', agency: 'CMC (Canada)', resolution: '15-25 km' }
];

export const RUN_PALETTE = [
  '#38bdf8', // Latest: vibrant sky cyan
  '#f59e0b', // -6h: amber gold
  '#f43f5e', // -12h: rose red
  '#a855f7', // -18h: purple
  '#14b8a6', // -24h: teal
  '#94a3b8'  // -30h: slate gray
];

/**
 * Format a Date object to ISO "YYYY-MM-DDTHH:00" string in UTC
 */
export function formatRunIsoUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:00`;
}

/**
 * Derives user-friendly labels for a run initialization timestamp
 */
export function formatRunLabels(date: Date, offsetHours: number, isLatest: boolean): {
  label: string;
  shortLabel: string;
  relativeLabel: string;
} {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = dayNames[date.getUTCDay()];
  const monthDay = `${date.getUTCDate()}/${String(date.getUTCHours()).padStart(2, '0')}Z`;
  const timeStr = `${String(date.getUTCHours()).padStart(2, '0')}:00 UTC`;

  const relativeLabel = isLatest ? 'Latest' : `-${offsetHours}h`;
  const label = isLatest ? `${dayName} ${timeStr} (Latest)` : `${dayName} ${timeStr} (-${offsetHours}h)`;
  const shortLabel = monthDay;

  return { label, shortLabel, relativeLabel };
}

/**
 * Queries Open-Meteo model metadata to determine the latest available run
 */
async function fetchLatestRunTime(model: ModelId): Promise<Date | null> {
  try {
    const metaUrl = `https://api.open-meteo.com/data/${model}/static/meta.json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const resp = await fetch(metaUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (resp.ok) {
      const json = await resp.json();
      if (json && typeof json.last_run_initialisation_time === 'number') {
        return new Date(json.last_run_initialisation_time * 1000);
      }
    }
  } catch {
    // metadata endpoint is optional, fall back to calculation
  }
  return null;
}

/**
 * Computes candidate run strings (6-hour intervals) based on current UTC time or metadata
 */
export async function getCandidateRunDates(model: ModelId, count: number = 5): Promise<Date[]> {
  let latestDt = await fetchLatestRunTime(model);

  if (!latestDt) {
    const now = new Date();
    // Round down to previous 6-hour cycle
    const currentUTCHour = now.getUTCHours();
    const baseHour = Math.floor(currentUTCHour / 6) * 6;
    const candidate = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      baseHour,
      0, 0, 0
    ));

    // Global models typically lag real-time by 5 to 7 hours
    const ageHours = (now.getTime() - candidate.getTime()) / (3600 * 1000);
    if (ageHours < 5) {
      // Current cycle likely not published yet, step back 6h
      candidate.setUTCHours(candidate.getUTCHours() - 6);
    }
    latestDt = candidate;
  }

  const runDates: Date[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(latestDt.getTime() - i * 6 * 3600 * 1000);
    runDates.push(d);
  }
  return runDates;
}

/**
 * Fetches multiple consecutive runs for a specific model from Open-Meteo's Single Runs API
 */
export async function fetchRunEvolution(
  latitude: number,
  longitude: number,
  locationName: string,
  model: ModelId = 'ecmwf_ifs025',
  runCount: number = 5,
  options?: { forceRefresh?: boolean }
): Promise<RunEvolutionResult> {
  const modelMeta = EVOLUTION_MODELS.find(m => m.id === model) || EVOLUTION_MODELS[0];
  const runDates = await getCandidateRunDates(model, runCount);

  let hasCached = true;

  const fetchPromises = runDates.map(async (runDate, index) => {
    const runIso = formatRunIsoUtc(runDate);
    const url = new URL('https://single-runs-api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', latitude.toFixed(4));
    url.searchParams.set('longitude', longitude.toFixed(4));
    url.searchParams.set('models', model);
    url.searchParams.set('hourly', 'wind_gusts_10m,wind_speed_10m');
    url.searchParams.set('forecast_days', '3');
    url.searchParams.set('wind_speed_unit', 'kmh');
    url.searchParams.set('run', runIso);
    url.searchParams.sort();

    const urlString = url.toString();
    let data: any = null;

    if (!options?.forceRefresh) {
      const cached = getCachedData<any>(urlString);
      if (cached) {
        data = cached.data;
      }
    }

    if (!data) {
      hasCached = false;
      if (options?.forceRefresh) {
        deleteCachedData(urlString);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const resp = await fetch(urlString, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeout);

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        data = await resp.json();
        // Cache individual past runs with standard TTL
        setCachedData(urlString, data);
      } catch (err) {
        clearTimeout(timeout);
        throw err;
      }
    }

    return { runDate, runIso, index, data };
  });

  const results = await Promise.all(fetchPromises);

  // Parse each run info
  const runs: SingleRunInfo[] = results.map(({ runDate, runIso, index, data }) => {
    const hourlyTimes: string[] = data.hourly?.time || [];
    const hourlyGusts: (number | null)[] = data.hourly?.wind_gusts_10m || [];
    const hourlySpeeds: (number | null)[] = data.hourly?.wind_speed_10m || [];

    let peakGust = 0;
    let peakGustTime = '';

    hourlyGusts.forEach((g, i) => {
      if (g !== null && g > peakGust) {
        peakGust = g;
        peakGustTime = hourlyTimes[i] || '';
      }
    });

    const isLatest = index === 0;
    const offsetHours = index * 6;
    const { label, shortLabel, relativeLabel } = formatRunLabels(runDate, offsetHours, isLatest);
    const color = RUN_PALETTE[index % RUN_PALETTE.length];

    return {
      runId: runIso,
      initializationTime: runDate,
      label,
      shortLabel,
      relativeLabel,
      offsetHours,
      color,
      isLatest,
      hourly: {
        time: hourlyTimes,
        windGusts: hourlyGusts,
        windSpeed: hourlySpeeds
      },
      peakGust,
      peakGustTime
    };
  });

  // Calculate common timeline (next 48 to 72 hours from latest run's start)
  const latestTimes = runs[0]?.hourly.time || [];
  const timeline = latestTimes.slice(0, 54); // 54 hours (2.25 days)

  return {
    latitude,
    longitude,
    model,
    modelName: modelMeta.name,
    agency: modelMeta.agency,
    locationName,
    fetchedAt: new Date(),
    runs,
    timeline,
    isCached: hasCached
  };
}

/**
 * Generates realistic simulation data for run evolution in offline/demo mode
 */
export function generateDemoRunEvolution(
  latitude: number,
  longitude: number,
  locationName: string,
  model: ModelId = 'ecmwf_ifs025',
  runCount: number = 5
): RunEvolutionResult {
  const modelMeta = EVOLUTION_MODELS.find(m => m.id === model) || EVOLUTION_MODELS[0];
  const now = new Date();
  const baseHour = Math.floor(now.getUTCHours() / 6) * 6;
  const latestDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), baseHour));

  const runs: SingleRunInfo[] = [];

  for (let rIdx = 0; rIdx < runCount; rIdx++) {
    const runDate = new Date(latestDate.getTime() - rIdx * 6 * 3600 * 1000);
    const runIso = formatRunIsoUtc(runDate);
    const isLatest = rIdx === 0;
    const offsetHours = rIdx * 6;
    const { label, shortLabel, relativeLabel } = formatRunLabels(runDate, offsetHours, isLatest);
    const color = RUN_PALETTE[rIdx % RUN_PALETTE.length];

    // Simulate storm evolution:
    // Earlier runs (e.g. -12h, -18h, -24h) had a severe storm (100-120 km/h)
    // Latest run shows it weakening to 60 km/h
    const stormSeverityFactor = 1.0 + (runCount - 1 - rIdx) * 0.18; // older runs were stronger
    const stormPeakHourOffset = 24 + (rIdx * 2); // peak shifts slightly in time

    const hourlyTimes: string[] = [];
    const hourlyGusts: (number | null)[] = [];
    const hourlySpeeds: (number | null)[] = [];

    let peakGust = 0;
    let peakGustTime = '';

    for (let h = 0; h < 72; h++) {
      const hourDate = new Date(runDate.getTime() + h * 3600 * 1000);
      const timeStr = hourDate.toISOString().slice(0, 16);
      hourlyTimes.push(timeStr);

      // Bell curve storm spike
      const distFromStorm = Math.abs(h - stormPeakHourOffset);
      const stormBoost = Math.max(0, 55 * Math.exp(-(distFromStorm * distFromStorm) / 60));
      const diurnal = Math.sin((h / 24) * 2 * Math.PI) * 8;
      const baseGust = 30 + diurnal + (stormBoost * stormSeverityFactor);

      const gust = Math.round(Math.max(12, baseGust) * 10) / 10;
      const speed = Math.round((gust / 1.4) * 10) / 10;

      hourlyGusts.push(gust);
      hourlySpeeds.push(speed);

      if (gust > peakGust) {
        peakGust = gust;
        peakGustTime = timeStr;
      }
    }

    runs.push({
      runId: runIso,
      initializationTime: runDate,
      label,
      shortLabel,
      relativeLabel,
      offsetHours,
      color,
      isLatest,
      hourly: {
        time: hourlyTimes,
        windGusts: hourlyGusts,
        windSpeed: hourlySpeeds
      },
      peakGust,
      peakGustTime
    });
  }

  const timeline = runs[0].hourly.time.slice(0, 54);

  return {
    latitude,
    longitude,
    model,
    modelName: modelMeta.name,
    agency: modelMeta.agency,
    locationName: `${locationName} (Demo Mode)`,
    fetchedAt: new Date(),
    runs,
    timeline,
    isCached: false
  };
}

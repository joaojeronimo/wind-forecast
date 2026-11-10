import {
  ModelId,
  ModelInfo,
  ModelDataPoint,
  ForecastResult
} from '../types';
import { aggregateHour } from '../utils/aggregation';

export const AVAILABLE_MODELS: ModelInfo[] = [
  { id: 'best_match', name: 'Best Match', agency: 'Open-Meteo Blend', resolution: '1-11 km', color: '#0284c7', enabled: true },
  { id: 'ecmwf_ifs025', name: 'ECMWF IFS', agency: 'European Centre (ECMWF)', resolution: '25 km', color: '#4f46e5', enabled: true },
  { id: 'gfs_seamless', name: 'GFS Seamless', agency: 'NOAA (USA)', resolution: '13-28 km', color: '#059669', enabled: true },
  { id: 'icon_seamless', name: 'ICON Seamless', agency: 'DWD (Germany)', resolution: '2-13 km', color: '#d97706', enabled: true },
  { id: 'gem_seamless', name: 'GEM Seamless', agency: 'CMC (Canada)', resolution: '15-25 km', color: '#e11d48', enabled: true },
  { id: 'meteofrance_seamless', name: 'Météo-France', agency: 'Météo-France', resolution: '2-25 km', color: '#7c3aed', enabled: true },
  { id: 'ukmo_seamless', name: 'UKMO Seamless', agency: 'UK Met Office', resolution: '10-25 km', color: '#db2777', enabled: true },
  { id: 'jma_seamless', name: 'JMA Seamless', agency: 'Japan Met Agency', resolution: '5-20 km', color: '#0d9488', enabled: true }
];

export async function fetchWindForecast(
  latitude: number,
  longitude: number,
  locationName: string,
  modelsToQuery: ModelId[] = AVAILABLE_MODELS.map(m => m.id),
  forecastDays = 3
): Promise<ForecastResult> {
  const modelsParam = modelsToQuery.join(',');
  const hourlyVariables = [
    'wind_speed_10m',
    'wind_direction_10m',
    'wind_gusts_10m',
    'temperature_2m'
  ].join(',');

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', latitude.toFixed(4));
  url.searchParams.set('longitude', longitude.toFixed(4));
  url.searchParams.set('hourly', hourlyVariables);
  url.searchParams.set('forecast_days', forecastDays.toString());
  url.searchParams.set('models', modelsParam);
  url.searchParams.set('wind_speed_unit', 'kmh'); // We fetch in base km/h and convert client-side
  url.searchParams.set('timezone', 'auto');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Open-Meteo request timed out. Please check your internet connection.');
    }
    throw new Error(`Network error calling Open-Meteo: ${(err as Error).message}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Open-Meteo API returned HTTP ${response.status}: ${errorBody || response.statusText}`);
  }

  const data = await response.json();
  const hourly = data.hourly;
  if (!hourly || !Array.isArray(hourly.time)) {
    throw new Error('Unexpected response format from Open-Meteo API: missing hourly data.');
  }

  const times: string[] = hourly.time;
  const now = new Date();
  // Find current hour index or start from index 0
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  let startIndex = times.findIndex(t => new Date(t) >= oneHourAgo);
  if (startIndex === -1) startIndex = 0;

  // We want the next 48 hours
  const endIndex = Math.min(times.length, startIndex + 48);
  const selectedTimes = times.slice(startIndex, endIndex);

  const hours = selectedTimes.map((timeStr, offset) => {
    const absoluteIndex = startIndex + offset;
    const modelMap: Partial<Record<ModelId, ModelDataPoint>> = {};

    for (const model of modelsToQuery) {
      const speedKey = `wind_speed_10m_${model}`;
      const dirKey = `wind_direction_10m_${model}`;
      const gustKey = `wind_gusts_10m_${model}`;
      const tempKey = `temperature_2m_${model}`;

      const rawSpeed = hourly[speedKey]?.[absoluteIndex];
      const rawDir = hourly[dirKey]?.[absoluteIndex];
      const rawGust = hourly[gustKey]?.[absoluteIndex];
      const rawTemp = hourly[tempKey]?.[absoluteIndex];

      if (rawSpeed !== undefined && rawSpeed !== null && !isNaN(rawSpeed)) {
        modelMap[model] = {
          speed: Number(rawSpeed),
          direction: Number(rawDir ?? 0),
          gust: rawGust !== undefined && rawGust !== null ? Number(rawGust) : undefined,
          temperature: rawTemp !== undefined && rawTemp !== null ? Number(rawTemp) : undefined
        };
      }
    }

    return aggregateHour(timeStr, modelMap, modelsToQuery);
  });

  return {
    latitude: data.latitude,
    longitude: data.longitude,
    timezone: data.timezone || 'UTC',
    elevation: data.elevation || 0,
    fetchedAt: new Date(),
    locationName,
    hours,
    activeModels: modelsToQuery
  };
}

/**
 * Generates synthetic realistic multi-model forecast data for offline demo or fallback testing
 */
export function generateDemoForecast(
  latitude: number,
  longitude: number,
  locationName: string
): ForecastResult {
  const models = AVAILABLE_MODELS.map(m => m.id);
  const now = new Date();
  now.setMinutes(0, 0, 0);

  const hours = Array.from({ length: 48 }, (_, i) => {
    const timeDate = new Date(now.getTime() + i * 3600 * 1000);
    const timeStr = timeDate.toISOString().slice(0, 19);

    // Diurnal wind cycle simulation (thermal effect)
    const hourOfDay = timeDate.getHours();
    const thermalBoost = Math.sin(((hourOfDay - 8) / 12) * Math.PI);
    const baseSpeed = 18 + (thermalBoost > 0 ? thermalBoost * 14 : 0);
    const baseDir = 330 + Math.sin(i / 10) * 20; // NNW wind
    const baseTemp = 16 + (thermalBoost > 0 ? thermalBoost * 6 : -2);

    const modelMap: Partial<Record<ModelId, ModelDataPoint>> = {};
    models.forEach((m, mIdx) => {
      // Model variations
      const modelSpeedBias = (mIdx % 3 - 1) * 2.5 + Math.sin(i + mIdx) * 2;
      const modelDirBias = (mIdx % 2 === 0 ? 1 : -1) * (mIdx * 3);
      const speed = Math.max(2, baseSpeed + modelSpeedBias);
      const direction = ((baseDir + modelDirBias) % 360 + 360) % 360;
      const gust = speed * (1.25 + (mIdx % 3) * 0.1);
      const temperature = baseTemp + (mIdx % 2 === 0 ? 0.5 : -0.5);

      modelMap[m] = {
        speed: Math.round(speed * 10) / 10,
        direction: Math.round(direction),
        gust: Math.round(gust * 10) / 10,
        temperature: Math.round(temperature * 10) / 10
      };
    });

    return aggregateHour(timeStr, modelMap, models);
  });

  return {
    latitude,
    longitude,
    timezone: 'Local (Demo Mode)',
    elevation: 25,
    fetchedAt: new Date(),
    locationName: `${locationName} (Demo Data)`,
    hours,
    activeModels: models
  };
}

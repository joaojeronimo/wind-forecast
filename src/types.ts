export type ModelId =
  | 'best_match'
  | 'ecmwf_ifs025'
  | 'gfs_seamless'
  | 'icon_seamless'
  | 'gem_seamless'
  | 'meteofrance_seamless'
  | 'ukmo_seamless';

export interface ModelInfo {
  id: ModelId;
  name: string;
  agency: string;
  resolution: string;
  color: string;
  enabled: boolean;
}

export type SpeedUnit = 'knots' | 'kmh' | 'ms' | 'mph';
export type TempUnit = 'celsius' | 'fahrenheit';

export interface BeaufortInfo {
  number: number;
  label: string;
  color: string;
  description: string;
  seaConditions: string;
}

export type ConsensusRating = 'high' | 'moderate' | 'divergent';

export interface ModelDataPoint {
  gust: number;         // Gust speed in km/h from Open-Meteo wind_gusts_10m
  speed?: number;       // Sustained speed in km/h
  direction: number;    // degrees (0-360)
  temperature?: number; // Celsius
}

export interface AggregatedHour {
  time: string;           // ISO timestamp string from API
  date: Date;
  hourLabel: string;      // e.g. "14:00"
  dayLabel: string;       // e.g. "Tue, Nov 10"
  isCurrentHour: boolean;

  // Aggregated Wind Gusts (stored in km/h, converted dynamically for display)
  gustMax: number;        // Peak predicted gust across all models
  gustMean: number;       // Consensus average gust across models
  gustMedian: number;     // Median gust across models
  gustMin: number;        // Lowest predicted gust among models
  gustStdDev: number;     // Standard deviation of gust predictions

  // Sustained speed (kept as reference)
  speedMean: number;

  // Aggregated Wind Direction
  directionMean: number;      // 0 - 360 degrees (vector average)
  directionSpread: number;    // angular std deviation (degrees)
  cardinal: string;           // N, NNE, NE, etc.

  // Temperature
  tempMean: number;
  tempMin: number;
  tempMax: number;

  // Analysis based on Gusts
  beaufort: BeaufortInfo;
  consensus: ConsensusRating;
  reportingModelsCount: number;

  // Breakdown per model
  modelValues: Partial<Record<ModelId, ModelDataPoint>>;
}

export interface ForecastResult {
  latitude: number;
  longitude: number;
  timezone: string;
  elevation: number;
  fetchedAt: Date;
  locationName: string;
  hours: AggregatedHour[];
  activeModels: ModelId[];
  isCached?: boolean;
}

export interface LocationInfo {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  timezone?: string;
}

export interface AppSettings {
  speedUnit: SpeedUnit;
  tempUnit: TempUnit;
  activeModels: ModelId[];
  theme: 'dark' | 'light' | 'nautical';
  autoRefreshMinutes: number;
}

export type ViewMode = 'ensemble' | 'evolution';

export interface SingleRunInfo {
  runId: string;
  initializationTime: Date;
  label: string;
  shortLabel: string;
  relativeLabel: string;
  offsetHours: number;
  color: string;
  isLatest: boolean;
  hourly: {
    time: string[];
    windGusts: (number | null)[];
    windSpeed: (number | null)[];
  };
  peakGust: number;
  peakGustTime: string;
}

export interface RunEvolutionResult {
  latitude: number;
  longitude: number;
  model: ModelId;
  modelName: string;
  agency: string;
  locationName: string;
  fetchedAt: Date;
  runs: SingleRunInfo[];
  timeline: string[];
  isCached?: boolean;
}


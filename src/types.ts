export type ModelId =
  | 'best_match'
  | 'ecmwf_ifs025'
  | 'gfs_seamless'
  | 'icon_seamless'
  | 'gem_seamless'
  | 'meteofrance_seamless'
  | 'ukmo_seamless'
  | 'jma_seamless';

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
  speed: number;        // in km/h from API
  direction: number;    // degrees (0-360)
  gust?: number;        // km/h
  temperature?: number; // Celsius
}

export interface AggregatedHour {
  time: string;           // ISO timestamp string from API
  date: Date;
  hourLabel: string;      // e.g. "14:00"
  dayLabel: string;       // e.g. "Tue, Nov 10"
  isCurrentHour: boolean;

  // Aggregated Wind Speed (stored in km/h, converted dynamically for display)
  speedMean: number;
  speedMedian: number;
  speedMin: number;
  speedMax: number;
  speedStdDev: number;

  // Aggregated Wind Direction
  directionMean: number;      // 0 - 360 degrees (vector average)
  directionSpread: number;    // angular std deviation (degrees)
  cardinal: string;           // N, NNE, NE, etc.

  // Gusts & Temp
  gustMax: number;
  gustMean: number;
  tempMean: number;
  tempMin: number;
  tempMax: number;

  // Analysis
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

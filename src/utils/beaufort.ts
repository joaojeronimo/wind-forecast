import { BeaufortInfo } from '../types';

/**
 * Returns the Beaufort scale level and metadata based on wind speed in km/h.
 */
export function getBeaufort(kmh: number): BeaufortInfo {
  if (kmh < 1.0) {
    return {
      number: 0,
      label: 'Calm',
      color: '#94a3b8', // slate-400
      description: 'Smoke rises vertically. Sea like a mirror.',
      seaConditions: 'Mirror-flat'
    };
  } else if (kmh < 5.6) {
    return {
      number: 1,
      label: 'Light air',
      color: '#38bdf8', // sky-400
      description: 'Direction shown by smoke drift, not by wind vanes.',
      seaConditions: 'Ripples with appearance of scales'
    };
  } else if (kmh < 12.0) {
    return {
      number: 2,
      label: 'Light breeze',
      color: '#22d3ee', // cyan-400
      description: 'Wind felt on face; leaves rustle; vanes moved by wind.',
      seaConditions: 'Small wavelets; crests have glassy appearance'
    };
  } else if (kmh < 20.0) {
    return {
      number: 3,
      label: 'Gentle breeze',
      color: '#34d399', // emerald-400
      description: 'Leaves and small twigs in constant motion; light flags extended.',
      seaConditions: 'Large wavelets; crests begin to break; scattered whitecaps'
    };
  } else if (kmh < 29.0) {
    return {
      number: 4,
      label: 'Moderate breeze',
      color: '#a3e635', // lime-400
      description: 'Raises dust and loose paper; small branches are moved.',
      seaConditions: 'Small waves becoming longer; fairly frequent whitecaps'
    };
  } else if (kmh < 39.0) {
    return {
      number: 5,
      label: 'Fresh breeze',
      color: '#facc15', // yellow-400
      description: 'Small trees in leaf begin to sway; crested wavelets form on inland waters.',
      seaConditions: 'Moderate waves taking a more pronounced long form; many whitecaps'
    };
  } else if (kmh < 50.0) {
    return {
      number: 6,
      label: 'Strong breeze',
      color: '#fb923c', // orange-400
      description: 'Large branches in motion; whistling heard in telegraph wires; umbrellas used with difficulty.',
      seaConditions: 'Large waves begin to form; extensive white foam crests everywhere'
    };
  } else if (kmh < 62.0) {
    return {
      number: 7,
      label: 'High wind / Near gale',
      color: '#f87171', // red-400
      description: 'Whole trees in motion; inconvenience felt when walking against the wind.',
      seaConditions: 'Sea heaps up; white foam from breaking waves blown in streaks'
    };
  } else if (kmh < 75.0) {
    return {
      number: 8,
      label: 'Gale',
      color: '#ef4444', // red-500
      description: 'Breaks twigs off trees; generally impedes progress.',
      seaConditions: 'Moderately high waves of greater length; edges of crests break into spindrift'
    };
  } else if (kmh < 89.0) {
    return {
      number: 9,
      label: 'Strong gale',
      color: '#dc2626', // red-600
      description: 'Slight structural damage occurs (chimney-pots and slates removed).',
      seaConditions: 'High waves; dense streaks of foam along the direction of the wind'
    };
  } else if (kmh < 103.0) {
    return {
      number: 10,
      label: 'Storm',
      color: '#b91c1c', // red-700
      description: 'Trees uprooted; considerable structural damage occurs.',
      seaConditions: 'Very high waves with long overhanging crests; sea takes white appearance'
    };
  } else if (kmh < 118.0) {
    return {
      number: 11,
      label: 'Violent storm',
      color: '#9333ea', // purple-600
      description: 'Widespread damage; accompanied by heavy sea disruption.',
      seaConditions: 'Exceptionally high waves; small- and medium-sized ships lost to view'
    };
  } else {
    return {
      number: 12,
      label: 'Hurricane force',
      color: '#7e22ce', // purple-700
      description: 'Devastation occurs.',
      seaConditions: 'Air filled with foam and spray; sea completely white'
    };
  }
}

export const PURPLE_GUST_THRESHOLD_KMH = 140;

interface ColorStop {
  kmh: number;
  r: number;
  g: number;
  b: number;
  hex: string;
}

const GUST_COLOR_STOPS: ColorStop[] = [
  { kmh: 30, r: 34, g: 197, b: 94, hex: '#22c55e' },    // <= 30 km/h: Green
  { kmh: 42, r: 163, g: 230, b: 53, hex: '#a3e635' },   // Bright Lime
  { kmh: 55, r: 250, g: 204, b: 21, hex: '#facc15' },   // Vivid Yellow
  { kmh: 68, r: 245, g: 158, b: 11, hex: '#f59e0b' },   // Rich Amber
  { kmh: 82, r: 249, g: 115, b: 22, hex: '#f97316' },   // Bright Orange
  { kmh: 96, r: 239, g: 68, b: 68, hex: '#ef4444' },    // Scarlet Red
  { kmh: 110, r: 220, g: 38, b: 38, hex: '#dc2626' },   // Deep Crimson
  { kmh: 125, r: 217, g: 70, b: 239, hex: '#d946ef' },  // Vivid Magenta
  { kmh: 140, r: 147, g: 51, b: 234, hex: '#9333ea' }   // Purple (140 km/h)
];

function toHexByte(n: number): string {
  return Math.round(Math.max(0, Math.min(255, n)))
    .toString(16)
    .padStart(2, '0');
}

/**
 * Returns true if the gust intensity exceeds 140 km/h and should flash purple.
 */
export function isExtremeGust(kmh: number): boolean {
  return !isNaN(kmh) && kmh > PURPLE_GUST_THRESHOLD_KMH;
}

/**
 * Returns a hex color representing gust intensity in km/h:
 * Green (<= 30) -> Lime (42) -> Yellow (55) -> Amber (68) -> Orange (82) ->
 * Red (96) -> Crimson (110) -> Magenta (125) -> Purple (140+).
 */
export function getGustIntensityColor(kmh: number): string {
  if (isNaN(kmh) || kmh <= GUST_COLOR_STOPS[0].kmh) {
    return GUST_COLOR_STOPS[0].hex;
  }

  const lastStop = GUST_COLOR_STOPS[GUST_COLOR_STOPS.length - 1];
  if (kmh >= lastStop.kmh) {
    return lastStop.hex;
  }

  for (let i = 0; i < GUST_COLOR_STOPS.length - 1; i++) {
    const start = GUST_COLOR_STOPS[i];
    const end = GUST_COLOR_STOPS[i + 1];
    if (kmh >= start.kmh && kmh <= end.kmh) {
      const t = (kmh - start.kmh) / (end.kmh - start.kmh);
      const r = start.r + (end.r - start.r) * t;
      const g = start.g + (end.g - start.g) * t;
      const b = start.b + (end.b - start.b) * t;
      return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
    }
  }

  return lastStop.hex;
}

/**
 * Builds a CSS linear-gradient string coloring the timeline by hourly gust intensity.
 * Hours above 140 km/h use var(--gust-flash-color) so they flash purple.
 */
export function buildGustTimelineGradient(gustsKmh: number[]): string {
  if (gustsKmh.length === 0) {
    return 'var(--border-color)';
  }
  if (gustsKmh.length === 1) {
    const color = isExtremeGust(gustsKmh[0])
      ? 'var(--gust-flash-color, #9333ea)'
      : getGustIntensityColor(gustsKmh[0]);
    return `linear-gradient(var(--slider-direction, to right), ${color} 0%, ${color} 100%)`;
  }

  const maxIdx = gustsKmh.length - 1;
  const stops = gustsKmh.map((kmh, i) => {
    const pct = ((i / maxIdx) * 100).toFixed(2);
    const color = isExtremeGust(kmh)
      ? 'var(--gust-flash-color, #9333ea)'
      : getGustIntensityColor(kmh);
    return `${color} ${pct}%`;
  });

  return `linear-gradient(var(--slider-direction, to right), ${stops.join(', ')})`;
}


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

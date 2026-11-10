# Wind Forecast

A responsive web application providing 48-hour wind predictions aggregated across multiple weather forecast models using the Open-Meteo API.

## Features

- **Geolocation & Spot Search**: Share your device's GPS coordinates with one click, search any city or coastal spot worldwide via geocoding, or select from preset sailing and kite spots.
- **Multi-Model Ensemble Aggregation**: Combines hourly wind forecasts from major meteorological models:
  - ECMWF IFS (European Centre for Medium-Range Weather Forecasts)
  - NOAA GFS Seamless (United States)
  - DWD ICON Seamless (Germany)
  - CMC GEM Seamless (Canada)
  - Météo-France Seamless (France)
  - UK Met Office Seamless (United Kingdom)
  - JMA Seamless (Japan)
  - Open-Meteo Best Match blend
- **Circular Vector Averaging**: Calculates true circular mean wind direction using meteorological zonal and meridional vector decomposition ($u, v$ components), avoiding naive arithmetic averaging errors across the $0^\circ / 360^\circ$ boundary.
- **Ensemble Consensus & Spread**: Evaluates forecast agreement and displays minimum, mean, median, maximum, and standard deviation across models.
- **Interactive 48-Hour Time Scrubber**: Drag or step forward and backward hour-by-hour to inspect wind speed, gusts, direction, temperature, and individual model breakdowns.
- **Canvas Multi-Model Chart**: Interactive high-DPI timeline visualization plotting the model spread corridor, consensus curve, individual model lines, and airflow arrows.
- **Accessible Forecast Matrix**: Sticky-header data table following accessibility guidelines for responsive scrolling and keyboard navigation.
- **Flexible Units**: Toggle between Knots, km/h, m/s, mph, and Celsius/Fahrenheit.
- **Zero-Dependency Node Server**: Includes an optional standalone Node.js server (`server.js`) that serves built assets and provides an optional API proxy endpoint.

## Getting Started

### Prerequisites

- Node.js (v20+ recommended)
- `pnpm` (or `npm`)

### Installation

```bash
git clone git@github.com:joaojeronimo/wind-forecast.git
cd wind-forecast
pnpm install
```

### Development

Run the Vite local development server:

```bash
pnpm dev
```

### Production Build

Build the static site into `dist/`:

```bash
pnpm build
```

### Running with the Built-in Server

Run the production server:

```bash
pnpm start
```

Or open `http://localhost:3000` in your browser.

### Running Unit Tests

Run the Vitest test suite:

```bash
pnpm test
```

## Data Attribution

Weather data is provided by [Open-Meteo](https://open-meteo.com/) under the Creative Commons Attribution 4.0 International license (CC BY 4.0).

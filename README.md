# Performance Distance Planner

Get daily stages and performance kilometers from your Google Earth route.

A client-side web tool that parses GPX/KML files, splits routes into daily stages based on waypoints, fetches elevation data, and calculates performance distance (Leistungskilometer) for each stage.

## Features

- **GPX & KML upload** — drag-and-drop or click to browse, auto-detected by file extension
- **Track-only analysis** — files without waypoints are treated as a single stage with all metrics
- **Stage calculation** — distance (km), ascent (hm ↑), descent (hm ↓), performance distance (Lkm)
- **Waypoint filtering** — recognizes stage waypoints (e.g. `T01.1`, `T01.3a`), ignores other types
- **Variant selection** — picks the preferred overnight option when multiple exist (no suffix > a > b > c)
- **Elevation lookup** — switchable between [Open-Elevation](https://open-elevation.com) and [Open-Meteo](https://open-meteo.com), with auto-retry
- **API toggle** — switch elevation provider on the fly; auto-refetches when a file is loaded
- **Adjustable formula** — configurable ascent/descent divisors for the Lkm calculation
- **CSV export** — download stage data for spreadsheets
- **Route map** — interactive 3D satellite map with color-coded route (elevation or steepness), waypoint markers, and terrain toggle
- **Info page** — built-in guide explaining route planning and calculations

## Performance Distance Formula

```
Lkm = Distance (km) + Ascent (m) / 100 + Descent (m) / 150
```

Descent is optional (disabled by default). Both divisors are adjustable in the UI.

**Example:** 12 km distance + 800 m ascent = 12 + 8 = **20 Lkm**

## Waypoint Naming Convention

`TXX` = Team + team number. Stage waypoints follow the pattern `TXX.Y` where `Y` is the day number.

| Prefix | Meaning | Example |
|--------|---------|---------|
| `TXX.Y` | Stage endpoint (overnight) | `T01.3`, `T01.3a` |
| `DXX` | Drop-off point | `D01` |
| `PiXX` | Pick-up point | `Pi01` |
| `GEXX.Y` | Danger zone | `GE01.2` |
| `PXX.Y` | Pass (include elevation) | `P01.1` |
| `FXX.Y` | River crossing | `F01.5` |
| `HXX.Y` | Highlight | `H01.6` |
| `EXX.Y` | Evacuation point | `E01.4` |

Only **T-waypoints** are used for stage splitting. All other types are ignored.

## Stage Calculation

Each T-waypoint is **snapped to the nearest point on the track** (by geodesic distance). The route is then split at those track points, creating one stage between each consecutive pair.

- If the file contains **no waypoints**, the entire track is treated as a single stage
- Waypoints don't need to sit exactly on the route — they can be up to a few hundred meters off
- The waypoint's own position is **only used to determine where to split** the track
- All distance and elevation measurements follow the actual track line
- Distance = sum of geodesic segments between consecutive track points
- Ascent/descent = sum of positive/negative elevation differences along those points

### Quality Indicator

Each stage includes a **Density** metric (traffic-light: green/yellow/red) showing the average spacing between consecutive track points:

| Green | Yellow | Red |
|-------|--------|-----|
| ≤ 50 m — dense, accurate | ≤ 150 m — moderate | > 150 m — sparse, less accurate |

Sparse tracks cut corners, reducing distance and elevation accuracy.

## Elevation Data

Google Earth Pro does not export usable elevation for paths. The tool fetches terrain elevation from one of two free APIs, selectable via a toggle:

| Provider | Resolution | Method | Notes |
|----------|-----------|--------|-------|
| **Open-Elevation** (default) | SRTM ~30 m | Single POST | Fast, but may have downtime |
| **Open-Meteo** (fallback) | Copernicus ~90 m | Batched GET (50 pts, 3 s delay) | Reliable, slower for large routes |

Both providers retry automatically on failure. Switching APIs with a file loaded triggers an automatic re-fetch.

## Architecture

```
src/
├── lib/
│   ├── gpx.js            — GPX/KML parsing, waypoint filtering, variant selection
│   ├── calc.js           — Stage splitting, distance/ascent/descent, Lkm calculation
│   ├── elevation.js      — Elevation API (Open-Elevation + Open-Meteo, switchable)
│   ├── csv.js            — CSV generation and download
│   ├── map-colors.js     — Color ramps, quantized GeoJSON segments for map visualization
│   ├── RouteMap.svelte   — Interactive 3D satellite map component (MapLibre GL)
│   ├── store.svelte.js   — Shared state (persists across navigation)
│   ├── gpx.test.js       — Tests: parsing, waypoint filtering, variants
│   ├── calc.test.js      — Tests: stage calculation, performance distance
│   └── csv.test.js       — Tests: CSV output
├── routes/
│   ├── +page.svelte      — Main UI: upload, formula bar, results table, export
│   ├── info/+page.svelte — Info page: route planning guide
│   ├── +layout.svelte    — App shell, page title, favicon
│   └── +layout.js        — SSR disabled, prerender enabled
```

### Data Flow

```
File Upload → parseFile() → extractTrack() + extractWaypoints()
  → filterStageWaypoints()   (T-prefix only, preferred variant)
  → fetchElevation()         (if no elevation data; uses selected API)
  → computeStages()          (split track, calculate per stage)
  → Results table / CSV export / Route map
```

## Tech Stack

- **SvelteKit** (Svelte 5) — client-only, static adapter, no SSR
- **@tmcw/togeojson** — GPX/KML → GeoJSON conversion
- **geolib** — geodesic distance calculation
- **MapLibre GL** — interactive map with 3D terrain (Esri satellite tiles, AWS Terrarium DEM)
- **Open-Elevation API** / **Open-Meteo API** — elevation data (free, no API key)
- **Vitest** — unit tests

## Setup

```sh
npm install
npm run dev
```

## Tests

```sh
npm test
```

31 tests covering waypoint filtering, stage calculation, and CSV export.

## Build

```sh
npm run build
npm run preview
```

Uses `@sveltejs/adapter-static` for static hosting (Netlify, Vercel, GitHub Pages, etc.).

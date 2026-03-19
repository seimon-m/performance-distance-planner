# Performance Distance Planner

Get daily stages and performance kilometers from your Google Earth route.

A client-side web tool that parses GPX/KML files, splits routes into daily stages based on waypoints, fetches elevation data, and calculates performance distance (Leistungskilometer) for each stage.

## Features

- **GPX & KML upload** — drag-and-drop or click to browse, auto-detected by file extension
- **Stage calculation** — distance (km), ascent (hm ↑), descent (hm ↓), performance distance (Lkm)
- **Waypoint filtering** — recognizes stage waypoints (e.g. `T01.1`, `T01.3a`), ignores other types
- **Variant selection** — picks the preferred overnight option when multiple exist (no suffix > a > b > c)
- **Elevation lookup** — automatic via [Open-Elevation API](https://open-elevation.com) with retry logic
- **Adjustable formula** — configurable ascent/descent divisors for the Lkm calculation
- **CSV export** — download stage data for spreadsheets
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

## Elevation Data

Google Earth Pro does not export usable elevation for paths. The tool fetches terrain elevation from the [Open-Elevation API](https://open-elevation.com) (free, no API key, SRTM ~30 m resolution). All coordinates are sent in a single POST request with automatic retry on failure.

## Architecture

```
src/
├── lib/
│   ├── gpx.js            — GPX/KML parsing, waypoint filtering, variant selection
│   ├── calc.js           — Stage splitting, distance/ascent/descent, Lkm calculation
│   ├── elevation.js      — Open-Elevation API with retry logic
│   ├── csv.js            — CSV generation and download
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
  → fetchElevation()         (if no elevation data present)
  → computeStages()          (split track, calculate per stage)
  → Results table / CSV export
```

## Tech Stack

- **SvelteKit** (Svelte 5) — client-only, static adapter, no SSR
- **@tmcw/togeojson** — GPX/KML → GeoJSON conversion
- **geolib** — geodesic distance calculation
- **Open-Elevation API** — elevation data (free, no API key)
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

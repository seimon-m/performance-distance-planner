# Route Checker

Get daily stages and performance kilometers from your Google Earth route.

Live at [route-checker.ch](https://www.route-checker.ch).

A client-side web tool that parses GPX/KML files, splits routes into daily stages based on waypoints, fetches elevation data, and calculates performance distance (Leistungskilometer) and walking time for each stage.

## Features

- **GPX & KML upload** — drag-and-drop or click to browse, auto-detected by file extension
- **Track-only analysis** — files without waypoints are treated as a single stage with all metrics
- **Stage calculation** — distance (km), ascent (hm ↑), descent (hm ↓), performance distance (Lkm), walking time
- **Walking time** — per-day estimate using the Swiss signpost formula (SAC / DIN 33466) with adjustable flat speed and ascent/descent rates
- **Waypoint filtering** — recognizes stage waypoints (e.g. `T01.1`, `T01.3a`), ignores other types
- **Tent spot variants** — nights with several overnight options get an interactive ⛺ night row in the table: spots sit on a mini route line at their real position along the track; picking one moves the split between the two adjacent days and shows the difference vs the preferred spot (distance, ascent, walking time)
- **Elevation lookup** — switchable between [Open-Elevation](https://open-elevation.com) and [Open-Meteo](https://open-meteo.com), with auto-retry
- **API toggle** — switch elevation provider on the fly; auto-refetches when a file is loaded
- **Adjustable formulas** — configurable ascent/descent divisors for Lkm; configurable speed and climb/descent rates for walking time
- **Sanity warnings** — missing elevation data fades the affected columns; tent spots more than 500 m off the route are marked amber with an inline note; merged stages (waypoints snapping to the same track point) are reported
- **CSV export** — transposed layout (rows = metrics, columns = days + Total) including walking time and the chosen tent spot per day, with a `sep=,` hint so Excel parses it correctly in any locale
- **Stage chart** — dual-axis canvas chart: elevation bars (hm ↑/↓) on the left axis, Lkm line on the right axis, walking time under each day label; dynamic scaling; downloadable as a print-friendly PNG at 4× resolution
- **Route map** — interactive 3D satellite map with color-coded route (elevation or steepness), waypoint markers that follow the selected tent spots, and terrain toggle; the MapLibre GL bundle is dynamically imported only when the map is revealed, with a static placeholder shown until then
- **Info page** — built-in guide explaining route planning and calculations

## Performance Distance Formula

```
Lkm = Distance (km) + Ascent (m) / 100 + Descent (m) / 150
```

Descent is optional (disabled by default). Both divisors are adjustable in the UI.

**Example:** 12 km distance + 800 m ascent = 12 + 8 = **20 Lkm**

## Walking Time Formula

The per-day walking time uses the formula behind Swiss hiking signposts (SAC, equivalent to DIN 33466):

```
Horizontal = Distance / 4.2 km/h
Vertical   = Ascent / 300 m/h + Descent / 500 m/h
Time       = larger component + smaller component / 2
```

All three parameters (flat speed, ascent rate, descent rate) are adjustable in the UI. The estimate is pure walking time without breaks.

**Example:** 12 km, 800 m ↑, 400 m ↓ → horizontal ≈ 2:51 h, vertical ≈ 3:28 h → 3:28 + 2:51/2 ≈ **4:54 h**

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

### Tent Spot Variants

Multiple overnight options per night use letter suffixes: `T01.3` (preferred), `T01.3a`, `T01.3b`, … (priority: no suffix > a > b > c). All variants are kept and shown in the night row between the two affected day rows — a tent spot is a *night*, so switching it changes both the day ending there and the day starting there. The variant only moves the **split point**; all measurements still follow the track, so a spot far off the route (> 500 m) is flagged because the extra way to it is not counted.

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
│   ├── gpx.js            — GPX/KML parsing, waypoint grouping per night, variant selection
│   ├── calc.js           — Stage splitting, distance/ascent/descent, Lkm, walking time
│   ├── elevation.js      — Elevation API (Open-Elevation + Open-Meteo, switchable)
│   ├── csv.js            — CSV generation (transposed layout) and download
│   ├── StageChart.svelte — Dual-axis canvas chart (hm bars + Lkm line), screen & print themes
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
  → groupStageWaypoints()    (T-prefix only, all tent spot variants kept per night)
  → selectStageWaypoints()   (one spot per night — preferred by default, user-switchable)
  → fetchElevation()         (if no elevation data; uses selected API)
  → computeStages()          (split track, calculate per stage)
  → Results table with night rows / CSV export / Stage chart / Route map (imported on reveal)
```

Switching a tent spot re-runs `selectStageWaypoints()` + `computeStages()` on the already-loaded track — no re-parse, no elevation re-fetch.

## Tech Stack

- **SvelteKit** (Svelte 5) — client-only, no SSR, deployed on Vercel
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

57 tests covering waypoint grouping and variant selection, stage calculation, walking time, elevation handling, and CSV export.

## Build

```sh
npm run build
npm run preview
```

Uses `@sveltejs/adapter-vercel`; deployed to Vercel via the GitHub integration (push to `main` = production deploy).

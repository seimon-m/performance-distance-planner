import { getDistance } from 'geolib';

/**
 * Interpolate between two hex colors.
 * @param {string} c1 - Start color hex (e.g. '#00ff00')
 * @param {string} c2 - End color hex
 * @param {number} t - 0..1
 * @returns {string} Interpolated hex color
 */
function lerpColor(c1, c2, t) {
	const r1 = parseInt(c1.slice(1, 3), 16);
	const g1 = parseInt(c1.slice(3, 5), 16);
	const b1 = parseInt(c1.slice(5, 7), 16);
	const r2 = parseInt(c2.slice(1, 3), 16);
	const g2 = parseInt(c2.slice(3, 5), 16);
	const b2 = parseInt(c2.slice(5, 7), 16);
	const r = Math.round(r1 + (r2 - r1) * t);
	const g = Math.round(g1 + (g2 - g1) * t);
	const b = Math.round(b1 + (b2 - b1) * t);
	return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Multi-stop color ramp. Stops is an array of [position, hexColor].
 * @param {Array<[number, string]>} stops - e.g. [[0, '#green'], [0.5, '#yellow'], [1, '#red']]
 * @param {number} t - 0..1
 * @returns {string} hex color
 */
function colorRamp(stops, t) {
	t = Math.max(0, Math.min(1, t));
	for (let i = 0; i < stops.length - 1; i++) {
		const [pos1, col1] = stops[i];
		const [pos2, col2] = stops[i + 1];
		if (t >= pos1 && t <= pos2) {
			const local = (t - pos1) / (pos2 - pos1);
			return lerpColor(col1, col2, local);
		}
	}
	return stops[stops.length - 1][1];
}

// Green → Yellow → Orange → Red
const ELEVATION_RAMP = [
	[0, '#2d9b4e'],
	[0.33, '#b8c832'],
	[0.66, '#e8961e'],
	[1, '#d4424b']
];
 
// Blue (downhill) → Green (flat) → Orange → Red (steep uphill)
const SLOPE_RAMP = [
	[0, '#3b82f6'],
	[0.3, '#60b0f4'],
	[0.5, '#2d9b4e'],
	[0.75, '#e8961e'],
	[1, '#d4424b']
];


/**
 * Build a GeoJSON FeatureCollection of LineString segments,
 * each colored by elevation or slope.
 *
 * @param {Array<[number, number, number?]>} track - [lon, lat, ele?]
 * @param {'elevation'|'slope'} mode
 * @returns {{ geojson: object, legend: { min: number, max: number, unit: string, ramp: Array<[number, string]> } }}
 */
export function buildColoredSegments(track, mode = 'elevation') {
	if (mode === 'elevation') return buildElevationSegments(track);
	return buildSlopeSegments(track);
}

const N_BUCKETS = 24;

/**
 * Quantize a 0..1 value into one of N_BUCKETS discrete buckets.
 */
function quantize(t) {
	return Math.min(N_BUCKETS - 1, Math.floor(t * N_BUCKETS));
}

/**
 * Merge consecutive segments sharing the same color bucket
 * into single multi-point LineStrings.
 */
function mergeSegments(track, buckets, ramp) {
	// Pre-compute one color per bucket
	const bucketColors = [];
	for (let b = 0; b < N_BUCKETS; b++) {
		bucketColors[b] = colorRamp(ramp, (b + 0.5) / N_BUCKETS);
	}

	const features = [];
	let runBucket = buckets[0];
	let coords = [[track[0][0], track[0][1]]];

	for (let i = 0; i < buckets.length; i++) {
		const nextCoord = [track[i + 1][0], track[i + 1][1]];

		if (buckets[i] === runBucket) {
			coords.push(nextCoord);
		} else {
			// Close previous run
			features.push({
				type: 'Feature',
				properties: { color: bucketColors[runBucket] },
				geometry: { type: 'LineString', coordinates: coords }
			});
			// Start new run — include the last point of the previous run for continuity
			runBucket = buckets[i];
			coords = [coords[coords.length - 1], nextCoord];
		}
	}

	// Close final run
	features.push({
		type: 'Feature',
		properties: { color: bucketColors[runBucket] },
		geometry: { type: 'LineString', coordinates: coords }
	});

	return features;
}

function buildElevationSegments(track) {
	let minEle = Infinity, maxEle = -Infinity;
	for (let i = 0; i < track.length; i++) {
		const e = track[i][2] ?? 0;
		if (e < minEle) minEle = e;
		if (e > maxEle) maxEle = e;
	}
	const range = maxEle - minEle || 1;

	const buckets = [];
	for (let i = 0; i < track.length - 1; i++) {
		const midEle = ((track[i][2] ?? 0) + (track[i + 1][2] ?? 0)) / 2;
		buckets.push(quantize((midEle - minEle) / range));
	}

	return {
		geojson: { type: 'FeatureCollection', features: mergeSegments(track, buckets, ELEVATION_RAMP) },
		legend: { min: Math.round(minEle), max: Math.round(maxEle), unit: 'm', ramp: ELEVATION_RAMP }
	};
}

function buildSlopeSegments(track) {
	const maxSlope = 30;
	const buckets = [];

	for (let i = 0; i < track.length - 1; i++) {
		const dist = getDistance(
			{ latitude: track[i][1], longitude: track[i][0] },
			{ latitude: track[i + 1][1], longitude: track[i + 1][0] }
		);
		const eleDiff = (track[i + 1][2] ?? 0) - (track[i][2] ?? 0);
		const slope = dist > 0 ? (eleDiff / dist) * 100 : 0;
		const t = Math.max(0, Math.min(1, (slope + maxSlope) / (2 * maxSlope)));
		buckets.push(quantize(t));
	}

	return {
		geojson: { type: 'FeatureCollection', features: mergeSegments(track, buckets, SLOPE_RAMP) },
		legend: { min: -maxSlope, max: maxSlope, unit: '%', ramp: SLOPE_RAMP }
	};
}

/**
 * Generate CSS gradient string for legend display.
 * @param {Array<[number, string]>} ramp
 * @returns {string}
 */
export function rampToGradient(ramp) {
	return `linear-gradient(to right, ${ramp.map(([pos, col]) => `${col} ${pos * 100}%`).join(', ')})`;
}

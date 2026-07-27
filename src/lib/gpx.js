import { gpx, kml } from '@tmcw/togeojson';

/**
 * Parse a GPX or KML file string into track coordinates and waypoints.
 * Auto-detects format based on filename extension.
 *
 * @param {string} fileContent - Raw XML string (GPX or KML)
 * @param {string} filename - Original filename, used for format detection
 * @returns {{ track: Array<[number, number, number?]>, waypoints: Array<{ name: string, lon: number, lat: number }> }}
 */
export function parseFile(fileContent, filename) {
	const ext = filename.split('.').pop()?.toLowerCase();

	if (ext === 'kml') {
		return parseKML(fileContent);
	}
	return parseGPX(fileContent);
}

/**
 * Parse a GPX file string into a GeoJSON FeatureCollection,
 * then extract the track coordinates and waypoint positions.
 *
 * @param {string} gpxString - Raw GPX XML string
 * @returns {{ track: Array<[number, number, number?]>, waypoints: Array<{ name: string, lon: number, lat: number }> }}
 */
export function parseGPX(gpxString) {
	const doc = parseXML(gpxString);
	const geojson = gpx(doc);
	return extractFromGeoJSON(geojson);
}

/**
 * Parse a KML file string into a GeoJSON FeatureCollection,
 * then extract the track coordinates and waypoint positions.
 * KML files preserve elevation data from Google Earth.
 *
 * @param {string} kmlString - Raw KML XML string
 * @returns {{ track: Array<[number, number, number?]>, waypoints: Array<{ name: string, lon: number, lat: number }> }}
 */
export function parseKML(kmlString) {
	const doc = parseXML(kmlString);
	const geojson = kml(doc);
	return extractFromGeoJSON(geojson);
}

/**
 * Parse an XML string into a DOM Document.
 *
 * @param {string} xmlString - Raw XML string
 * @returns {Document}
 */
function parseXML(xmlString) {
	const parser = new DOMParser();
	const doc = parser.parseFromString(xmlString, 'application/xml');

	// Check if parsing failed: browsers set the root element to <parsererror>
	// when the document is truly invalid. We check the root element's tag name
	// rather than using querySelector, which can false-match nested elements
	// in valid documents with complex namespaces.
	const root = doc.documentElement;
	if (root?.tagName === 'parsererror' || root?.nodeName === 'parsererror') {
		throw new Error('Invalid XML: file could not be parsed.');
	}

	return doc;
}

/**
 * Extract track and filtered stage waypoints from a GeoJSON FeatureCollection.
 *
 * @param {object} geojson - GeoJSON FeatureCollection
 * @returns {{ track: Array<[number, number, number?]>, waypoints: Array<{ name: string, lon: number, lat: number }> }}
 */
function extractFromGeoJSON(geojson) {
	const track = extractTrack(geojson);
	const allWaypoints = extractWaypoints(geojson);

	if (track.length === 0) {
		throw new Error('No track found in file.');
	}

	// Group stage waypoints by night, keeping all tent spot variants,
	// and default to the preferred variant per night.
	// If no waypoints exist, the entire track becomes a single stage.
	const stageGroups = allWaypoints.length > 0 ? groupStageWaypoints(allWaypoints) : [];
	let waypoints = [];
	if (stageGroups.length > 0) {
		waypoints = selectStageWaypoints(stageGroups);
	} else if (allWaypoints.length > 0) {
		// No stage pattern found — fall back to all waypoints
		waypoints = allWaypoints;
	}

	return { track, waypoints, stageGroups };
}

/**
 * Extract track coordinates from GeoJSON.
 * Supports LineString and MultiLineString geometries.
 *
 * @param {object} geojson - GeoJSON FeatureCollection
 * @returns {Array<[number, number, number?]>} Array of [lon, lat, ele?]
 */
export function extractTrack(geojson) {
	for (const feature of geojson.features) {
		if (feature.geometry.type === 'LineString') {
			return feature.geometry.coordinates;
		}
		if (feature.geometry.type === 'MultiLineString') {
			// Flatten all line segments into one continuous track
			return feature.geometry.coordinates.flat();
		}
	}
	return [];
}

/**
 * Extract waypoints (Point features) from GeoJSON.
 *
 * @param {object} geojson - GeoJSON FeatureCollection
 * @returns {Array<{ name: string, lon: number, lat: number }>}
 */
export function extractWaypoints(geojson) {
	return geojson.features
		.filter((f) => f.geometry.type === 'Point')
		.map((f) => ({
			name: f.properties?.name || 'Unnamed',
			lon: f.geometry.coordinates[0],
			lat: f.geometry.coordinates[1]
		}));
}

/**
 * Regex to match stage waypoint names.
 * Pattern: Prefix (letters + digits) + dot + stage number + optional variant letter
 * Variant may be separated by underscore, and can be upper or lowercase.
 * Examples: T10.1, T10.3a, T10.4b, T04.3_A, T04.8_B
 */
const STAGE_WAYPOINT_REGEX = /^([A-Za-z]+\d+)\.(\d+)(?:[_]?([a-zA-Z]))?$/;

/**
 * Group stage/overnight waypoints by stage number, keeping all tent spot
 * variants per night.
 *
 * Logic:
 * 1. Detect all waypoints matching the stage pattern (e.g. T10.1, T10.3a)
 * 2. Auto-detect the most common prefix (e.g. "T10")
 * 3. Group by stage number; sort each group's variants by priority:
 *    - No letter suffix has highest priority (e.g. T10.6 over T10.6a)
 *    - Then alphabetical: a > b > c > ...
 *
 * Returns [] when no waypoint matches the stage pattern.
 *
 * @param {Array<{ name: string, lon: number, lat: number }>} waypoints
 * @returns {Array<{ stageNum: number, variants: Array<{ name: string, lon: number, lat: number, variant: string }> }>}
 */
export function groupStageWaypoints(waypoints) {
	// Parse all waypoints that match the stage pattern
	const parsed = [];
	for (const wp of waypoints) {
		const match = wp.name.match(STAGE_WAYPOINT_REGEX);
		if (match) {
			parsed.push({
				...wp,
				prefix: match[1],
				stageNum: parseInt(match[2], 10),
				variant: (match[3] || '').toLowerCase() // normalized lowercase, empty = no variant
			});
		}
	}

	if (parsed.length === 0) {
		return [];
	}

	// Auto-detect prefix: prefer prefixes starting with 'T' (Team).
	// Other common prefixes: D = drop-off, Pi = pick-up, GE = danger zones, P = passes, F = river crossings, H = highlights, E = evacuation.
	// Fall back to most frequent prefix if no T-prefix exists.
	const prefixCounts = new Map();
	for (const p of parsed) {
		prefixCounts.set(p.prefix, (prefixCounts.get(p.prefix) || 0) + 1);
	}
	const allPrefixes = [...prefixCounts.entries()].sort((a, b) => b[1] - a[1]);
	const tPrefix = allPrefixes.find(([p]) => p.startsWith('T'));
	const detectedPrefix = tPrefix ? tPrefix[0] : allPrefixes[0][0];

	// Group by stage number, keeping every variant
	const groups = new Map();
	for (const wp of parsed) {
		if (wp.prefix !== detectedPrefix) continue;
		const { prefix, stageNum, ...variantWp } = wp;
		if (!groups.has(stageNum)) groups.set(stageNum, []);
		groups.get(stageNum).push(variantWp);
	}

	return [...groups.entries()]
		.sort((a, b) => a[0] - b[0])
		.map(([stageNum, variants]) => ({
			stageNum,
			variants: variants.sort((a, b) => compareVariants(a.variant, b.variant))
		}));
}

/**
 * Resolve stage groups to one waypoint per night.
 *
 * @param {Array<{ stageNum: number, variants: Array<{ name: string, lon: number, lat: number, variant: string }> }>} stageGroups
 * @param {Record<number, string>} [selection] - stageNum → variant letter ('' = unsuffixed).
 *   Nights without an entry (or with an unknown variant) fall back to the preferred variant.
 * @returns {Array<{ name: string, lon: number, lat: number }>}
 */
export function selectStageWaypoints(stageGroups, selection = {}) {
	return stageGroups.map((group) => {
		const wanted = selection[group.stageNum];
		const chosen =
			(wanted != null && group.variants.find((v) => v.variant === wanted)) || group.variants[0];
		const { variant, ...wp } = chosen;
		return wp;
	});
}

/**
 * Filter waypoints to only include stage/overnight waypoints,
 * picking the preferred tent spot variant per night.
 *
 * @param {Array<{ name: string, lon: number, lat: number }>} waypoints
 * @returns {Array<{ name: string, lon: number, lat: number }>}
 */
export function filterStageWaypoints(waypoints) {
	const stageGroups = groupStageWaypoints(waypoints);
	if (stageGroups.length === 0) {
		// No stage waypoints found — return all waypoints as fallback
		return waypoints;
	}
	return selectStageWaypoints(stageGroups);
}

/**
 * Compare two variant strings for priority.
 * Empty string (no variant) has highest priority,
 * then alphabetical: 'a' < 'b' < 'c' ...
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} negative if a is preferred, positive if b is preferred
 */
export function compareVariants(a, b) {
	if (a === b) return 0;
	if (a === '') return -1;
	if (b === '') return 1;
	return a.localeCompare(b);
}

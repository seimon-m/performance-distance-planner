import { getDistance } from 'geolib';

/**
 * Default ascent divisor for Leistungskilometer formula.
 * Lkm = distance_km + ascent_m / ASCENT_DIVISOR + descent_m / DESCENT_DIVISOR
 * Standard value: 100 (100m ascent = 1 Lkm)
 */
export const DEFAULT_ASCENT_DIVISOR = 100;

/**
 * Default descent divisor for Leistungskilometer formula.
 * 0 means descent is not included in the calculation.
 */
export const DEFAULT_DESCENT_DIVISOR = 0;

/**
 * Defaults for the SAC/DIN 33466 walking time formula,
 * as used on Swiss hiking signposts.
 */
export const DEFAULT_BASE_SPEED = 4.2; // km/h on flat ground
export const DEFAULT_ASCENT_RATE = 300; // m of ascent per hour
export const DEFAULT_DESCENT_RATE = 500; // m of descent per hour

/**
 * Estimate walking time using the SAC/DIN 33466 formula:
 * horizontal time = distance / baseSpeed, vertical time = ascent/ascentRate + descent/descentRate.
 * Total = the larger of the two plus half of the smaller.
 *
 * @param {number} distanceKm - Horizontal distance in kilometers
 * @param {number} ascentMeters - Positive elevation gain in meters
 * @param {number} descentMeters - Positive elevation loss in meters
 * @param {number} [baseSpeed=4.2] - Flat walking speed in km/h
 * @param {number} [ascentRate=300] - Meters of ascent per hour
 * @param {number} [descentRate=500] - Meters of descent per hour
 * @returns {number} Estimated walking time in hours
 */
export function walkingTime(
	distanceKm,
	ascentMeters,
	descentMeters,
	baseSpeed = DEFAULT_BASE_SPEED,
	ascentRate = DEFAULT_ASCENT_RATE,
	descentRate = DEFAULT_DESCENT_RATE
) {
	const horizontal = distanceKm / baseSpeed;
	const vertical = ascentMeters / ascentRate + descentMeters / descentRate;
	return Math.max(horizontal, vertical) + Math.min(horizontal, vertical) / 2;
}

/**
 * Format a duration in hours as "h:mm" (e.g. 5.58 → "5:35").
 *
 * @param {number} hours
 * @returns {string}
 */
export function formatDuration(hours) {
	const totalMinutes = Math.round(hours * 60);
	const h = Math.floor(totalMinutes / 60);
	const m = totalMinutes % 60;
	return `${h}:${String(m).padStart(2, '0')}`;
}

/**
 * Sort waypoints by their position along the track.
 * For each waypoint, find the nearest track point index,
 * then sort by that index ascending.
 *
 * @param {Array<{ name: string, lon: number, lat: number }>} waypoints
 * @param {Array<[number, number, number?]>} track - [lon, lat, ele?]
 * @returns {Array<{ name: string, lon: number, lat: number, trackIndex: number, snapDistance: number }>}
 */
export function sortWaypointsAlongTrack(waypoints, track) {
	const sorted = waypoints.map((wp) => {
		let minDist = Infinity;
		let bestIndex = 0;

		for (let i = 0; i < track.length; i++) {
			const dist = getDistance(
				{ latitude: wp.lat, longitude: wp.lon },
				{ latitude: track[i][1], longitude: track[i][0] }
			);
			if (dist < minDist) {
				minDist = dist;
				bestIndex = i;
			}
		}

		return { ...wp, trackIndex: bestIndex, snapDistance: minDist };
	});

	sorted.sort((a, b) => a.trackIndex - b.trackIndex);
	return sorted;
}

/**
 * Calculate stages from a track and sorted waypoints.
 *
 * Algorithm:
 * 1. Determine split indices from sorted waypoints (nearest track point per waypoint)
 * 2. Walk through track points sequentially
 * 3. Accumulate distance and positive elevation gain per segment
 * 4. When reaching a split index, close the current stage and start a new one
 * 5. Continue until end of track
 *
 * This approach is robust against waypoints that are far from the track
 * (common in KML-converted GPX files where waypoints can be 50–300m off).
 *
 * @param {Array<[number, number, number?]>} track - [lon, lat, ele?]
 * @param {Array<{ name: string, lon: number, lat: number, trackIndex: number }>} sortedWaypoints
 * @returns {Array<{ day: number, distance: number, ascent: number, performanceKm: number }>}
 */
export function calculateStages(track, sortedWaypoints, ascentDivisor = DEFAULT_ASCENT_DIVISOR, descentDivisor = DEFAULT_DESCENT_DIVISOR) {
	const splitIndices = new Set(sortedWaypoints.map((wp) => wp.trackIndex));

	// Waypoint name per split index, so each stage knows where it ends.
	// On collisions (two waypoints on the same track point) the first along
	// the track wins — the collision itself is reported separately in the UI.
	const splitNames = new Map();
	for (const wp of sortedWaypoints) {
		if (!splitNames.has(wp.trackIndex)) splitNames.set(wp.trackIndex, wp.name);
	}

	const stages = [];
	let stageDistance = 0; // in meters
	let stageAscent = 0; // in meters
	let stageDescent = 0; // in meters
	let stageSegments = 0; // number of point-to-point segments
	let dayNumber = 1;

	// Points without elevation carry the last known value forward —
	// treating them as 0 m would fabricate huge ascent/descent spikes.
	let lastEle = track[0]?.[2] ?? null;

	for (let i = 1; i < track.length; i++) {
		const prev = track[i - 1];
		const curr = track[i];

		// Accumulate geodesic distance
		const segmentDist = getDistance(
			{ latitude: prev[1], longitude: prev[0] },
			{ latitude: curr[1], longitude: curr[0] }
		);
		stageDistance += segmentDist;
		stageSegments++;

		// Accumulate elevation gain and loss
		const currEle = curr[2] ?? lastEle;
		if (lastEle != null && currEle != null) {
			const eleDiff = currEle - lastEle;
			if (eleDiff > 0) {
				stageAscent += eleDiff;
			} else if (eleDiff < 0) {
				stageDescent += Math.abs(eleDiff);
			}
		}
		if (currEle != null) lastEle = currEle;

		// If we reached a split point, close the current stage
		if (splitIndices.has(i)) {
			const density = stageSegments > 0 ? Math.round(stageDistance / stageSegments) : 0;
			stages.push({
				...buildStage(dayNumber, stageDistance, stageAscent, stageDescent, ascentDivisor, descentDivisor, density),
				endName: splitNames.get(i) ?? null
			});
			dayNumber++;
			stageDistance = 0;
			stageAscent = 0;
			stageDescent = 0;
			stageSegments = 0;
		}
	}

	// Final stage: from last split to end of track (no overnight spot at the end)
	if (stageDistance > 0 || stageAscent > 0 || stageDescent > 0) {
		const density = stageSegments > 0 ? Math.round(stageDistance / stageSegments) : 0;
		stages.push({
			...buildStage(dayNumber, stageDistance, stageAscent, stageDescent, ascentDivisor, descentDivisor, density),
			endName: null
		});
	}

	return stages;
}

/**
 * Build a stage object with calculated performance kilometers.
 *
 * Leistungskilometer = Horizontal Distance (km) + Ascent / ascentDivisor + Descent / descentDivisor
 * Example (ascDiv=100, descDiv=150): 10 km + 500 hm↑ + 300 hm↓ = 10 + 5 + 2 = 17 Lkm
 *
 * @param {number} day - Day number
 * @param {number} distanceMeters - Distance in meters
 * @param {number} ascentMeters - Positive elevation gain in meters
 * @param {number} descentMeters - Positive elevation loss in meters
 * @param {number} [ascentDivisor=100] - Meters of ascent per 1 Lkm
 * @param {number} [descentDivisor=150] - Meters of descent per 1 Lkm
 * @returns {{ day: number, distance: number, ascent: number, descent: number, performanceKm: number }}
 */
export function buildStage(day, distanceMeters, ascentMeters, descentMeters, ascentDivisor = DEFAULT_ASCENT_DIVISOR, descentDivisor = DEFAULT_DESCENT_DIVISOR, pointDensity = null) {
	const distanceKm = distanceMeters / 1000;
	const descentContribution = descentDivisor > 0 ? descentMeters / descentDivisor : 0;
	const performanceKm = distanceKm + ascentMeters / ascentDivisor + descentContribution;

	return {
		day,
		distance: Math.round(distanceKm * 100) / 100, // 2 decimal places
		ascent: Math.round(ascentMeters), // whole meters
		descent: Math.round(descentMeters), // whole meters
		performanceKm: Math.round(performanceKm * 100) / 100, // 2 decimal places
		pointDensity // average meters between consecutive track points in this stage
	};
}

/**
 * Main entry point: parse track + waypoints, compute all stages.
 *
 * @param {Array<[number, number, number?]>} track
 * @param {Array<{ name: string, lon: number, lat: number }>} waypoints
 * @returns {Array<{ day: number, distance: number, ascent: number, performanceKm: number }>}
 */
export function computeStages(track, waypoints, ascentDivisor = DEFAULT_ASCENT_DIVISOR, descentDivisor = DEFAULT_DESCENT_DIVISOR) {
	const sorted = sortWaypointsAlongTrack(waypoints, track);
	return calculateStages(track, sorted, ascentDivisor, descentDivisor);
}

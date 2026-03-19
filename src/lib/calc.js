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
 * Sort waypoints by their position along the track.
 * For each waypoint, find the nearest track point index,
 * then sort by that index ascending.
 *
 * @param {Array<{ name: string, lon: number, lat: number }>} waypoints
 * @param {Array<[number, number, number?]>} track - [lon, lat, ele?]
 * @returns {Array<{ name: string, lon: number, lat: number, trackIndex: number }>}
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

		return { ...wp, trackIndex: bestIndex };
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
	// Build a Set of track indices where stages should be split
	const splitIndices = new Set(sortedWaypoints.map((wp) => wp.trackIndex));

	const stages = [];
	let stageDistance = 0; // in meters
	let stageAscent = 0; // in meters
	let stageDescent = 0; // in meters
	let dayNumber = 1;

	for (let i = 1; i < track.length; i++) {
		const prev = track[i - 1];
		const curr = track[i];

		// Accumulate geodesic distance
		const segmentDist = getDistance(
			{ latitude: prev[1], longitude: prev[0] },
			{ latitude: curr[1], longitude: curr[0] }
		);
		stageDistance += segmentDist;

		// Accumulate elevation gain and loss
		const prevEle = prev[2] ?? 0;
		const currEle = curr[2] ?? 0;
		const eleDiff = currEle - prevEle;
		if (eleDiff > 0) {
			stageAscent += eleDiff;
		} else if (eleDiff < 0) {
			stageDescent += Math.abs(eleDiff);
		}

		// If we reached a split point, close the current stage
		if (splitIndices.has(i)) {
			stages.push(buildStage(dayNumber, stageDistance, stageAscent, stageDescent, ascentDivisor, descentDivisor));
			dayNumber++;
			stageDistance = 0;
			stageAscent = 0;
			stageDescent = 0;
		}
	}

	// Final stage: from last split to end of track
	if (stageDistance > 0 || stageAscent > 0 || stageDescent > 0) {
		stages.push(buildStage(dayNumber, stageDistance, stageAscent, stageDescent, ascentDivisor, descentDivisor));
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
export function buildStage(day, distanceMeters, ascentMeters, descentMeters, ascentDivisor = DEFAULT_ASCENT_DIVISOR, descentDivisor = DEFAULT_DESCENT_DIVISOR) {
	const distanceKm = distanceMeters / 1000;
	const descentContribution = descentDivisor > 0 ? descentMeters / descentDivisor : 0;
	const performanceKm = distanceKm + ascentMeters / ascentDivisor + descentContribution;

	return {
		day,
		distance: Math.round(distanceKm * 100) / 100, // 2 decimal places
		ascent: Math.round(ascentMeters), // whole meters
		descent: Math.round(descentMeters), // whole meters
		performanceKm: Math.round(performanceKm * 100) / 100 // 2 decimal places
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

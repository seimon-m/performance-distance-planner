const API_URL = 'https://api.open-elevation.com/api/v1/lookup';
const MAX_RETRIES = 3;

/**
 * Fetch elevation data for an array of track coordinates from the Open-Elevation API.
 * Uses a single POST request with all coordinates.
 *
 * @param {Array<[number, number, number?]>} track - [lon, lat, ele?]
 * @returns {Promise<Array<[number, number, number]>>} Track with real elevation data
 */
export async function fetchElevation(track) {
	const locations = track.map((p) => ({
		latitude: Math.round(p[1] * 10000) / 10000,
		longitude: Math.round(p[0] * 10000) / 10000
	}));

	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		if (attempt > 0) {
			await delay(2000);
		}

		let response;
		try {
			response = await fetch(API_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ locations })
			});
		} catch (err) {
			if (attempt === MAX_RETRIES) {
				throw new Error('Could not reach the Elevation API. Please check your internet connection and try again.');
			}
			continue;
		}

		if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
			if (attempt === MAX_RETRIES) {
				throw new Error('The Elevation API is currently overloaded. Please try again in a few minutes.');
			}
			continue;
		}

		if (!response.ok) {
			throw new Error(`Elevation API error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();

		if (!data.results || data.results.length !== track.length) {
			throw new Error('Unexpected response from the Elevation API. Please try again.');
		}

		return track.map((point, i) => [point[0], point[1], data.results[i].elevation]);
	}
}

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if a track has meaningful elevation data.
 * Returns false if all elevations are 0, undefined, or missing.
 *
 * @param {Array<[number, number, number?]>} track
 * @returns {boolean}
 */
export function hasElevationData(track) {
	return track.some((p) => p[2] !== undefined && p[2] !== 0);
}

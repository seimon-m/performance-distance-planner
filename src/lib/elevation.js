export const PROVIDERS = {
	'open-elevation': { name: 'Open-Elevation', note: 'SRTM 30m, may be down' },
	'open-meteo': { name: 'Open-Meteo', note: 'Copernicus 90m, reliable' }
};

export const DEFAULT_PROVIDER = 'open-elevation';

const MAX_RETRIES = 3;
const OPEN_METEO_BATCH_SIZE = 50;
const OPEN_METEO_BATCH_DELAY = 1500;

/**
 * Fetch elevation data using the selected provider.
 *
 * @param {Array<[number, number, number?]>} track - [lon, lat, ele?]
 * @param {string} provider - 'open-meteo' or 'open-elevation'
 * @param {function} [onProgress] - optional (batchNum, totalBatches) callback
 * @returns {Promise<Array<[number, number, number]>>} Track with real elevation data
 */
export async function fetchElevation(track, provider = DEFAULT_PROVIDER, onProgress) {
	if (provider === 'open-elevation') return fetchOpenElevation(track);
	return fetchOpenMeteo(track, onProgress);
}

// ── Open-Elevation (single POST) ──

async function fetchOpenElevation(track) {
	const locations = track.map((p) => ({
		latitude: Math.round(p[1] * 10000) / 10000,
		longitude: Math.round(p[0] * 10000) / 10000
	}));

	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		if (attempt > 0) await delay(2000);

		let response;
		try {
			response = await fetch('https://api.open-elevation.com/api/v1/lookup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ locations })
			});
		} catch (err) {
			if (attempt === MAX_RETRIES) {
				throw new Error('Could not reach Open-Elevation. The service may be down — try a different API.');
			}
			continue;
		}

		if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
			if (attempt === MAX_RETRIES) {
				throw new Error('Open-Elevation is overloaded. Try a different API.');
			}
			continue;
		}

		if (!response.ok) {
			throw new Error(`Open-Elevation error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();
		if (!data.results || data.results.length !== track.length) {
			throw new Error('Unexpected response from Open-Elevation.');
		}

		return track.map((point, i) => [point[0], point[1], data.results[i].elevation]);
	}
}

// ── Open-Meteo (batched GET) ──

async function fetchOpenMeteo(track, onProgress) {
	const allElevations = [];
	const totalBatches = Math.ceil(track.length / OPEN_METEO_BATCH_SIZE);

	for (let i = 0; i < track.length; i += OPEN_METEO_BATCH_SIZE) {
		if (i > 0) await delay(OPEN_METEO_BATCH_DELAY);

		const batchNum = Math.floor(i / OPEN_METEO_BATCH_SIZE) + 1;
		if (onProgress) onProgress(batchNum, totalBatches);

		const batch = track.slice(i, i + OPEN_METEO_BATCH_SIZE);
		const elevations = await fetchOpenMeteoBatch(batch);
		allElevations.push(...elevations);
	}

	return track.map((point, i) => [point[0], point[1], allElevations[i]]);
}

// ── Open-Meteo batch (GET, 50 points/req) ──

async function fetchOpenMeteoBatch(batch) {
	const latitudes = batch.map((p) => Math.round(p[1] * 10000) / 10000).join(',');
	const longitudes = batch.map((p) => Math.round(p[0] * 10000) / 10000).join(',');
	const url = `https://api.open-meteo.com/v1/elevation?latitude=${latitudes}&longitude=${longitudes}`;

	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		if (attempt > 0) await delay(3000);

		let response;
		try {
			response = await fetch(url);
		} catch (err) {
			if (attempt === MAX_RETRIES) {
				throw new Error('Could not reach Open-Meteo. Try a different API.');
			}
			continue;
		}

		if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
			if (attempt === MAX_RETRIES) {
				throw new Error('Open-Meteo is overloaded. Try a different API.');
			}
			continue;
		}

		if (!response.ok) {
			throw new Error(`Open-Meteo error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();
		if (data.error) {
			throw new Error(`Open-Meteo error: ${data.reason || 'Unknown error'}`);
		}
		if (!data.elevation || data.elevation.length !== batch.length) {
			throw new Error('Unexpected response from Open-Meteo.');
		}

		return data.elevation;
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

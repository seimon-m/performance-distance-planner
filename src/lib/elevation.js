export const PROVIDERS = {
	'terrarium': { name: 'Terrain Tiles', note: 'AWS terrarium tiles, global' },
	'open-elevation': { name: 'Open-Elevation', note: 'SRTM 30m, may be down' },
	'open-meteo': { name: 'Open-Meteo', note: 'Copernicus 90m, reliable' }
};

export const DEFAULT_PROVIDER = 'terrarium';

const MAX_RETRIES = 3;
const OPEN_METEO_BATCH_SIZE = 50;
const OPEN_METEO_BATCH_DELAY = 3000;
const OPEN_METEO_MAX_RETRIES = 5;

/**
 * Fetch elevation data using the selected provider.
 *
 * @param {Array<[number, number, number?]>} track - [lon, lat, ele?]
 * @param {string} provider - 'open-meteo', 'open-elevation' or 'terrarium'
 * @param {function} [onProgress] - optional (batchNum, totalBatches) callback
 * @returns {Promise<Array<[number, number, number]>>} Track with real elevation data
 */
export async function fetchElevation(track, provider = DEFAULT_PROVIDER, onProgress) {
	if (provider === 'open-elevation') return fetchOpenElevation(track);
	if (provider === 'terrarium') return fetchTerrarium(track, onProgress);
	return fetchOpenMeteo(track, onProgress);
}

// ── Open-Elevation (single POST) ──

// Open-Elevation is backed by SRTM, which was only collected between
// these latitudes. Outside them the API happily returns 0 for every
// point, which looks like "no data" downstream — fail fast instead.
const SRTM_LAT_MIN = -56;
const SRTM_LAT_MAX = 60;

async function fetchOpenElevation(track) {
	if (!track.some((p) => p[1] >= SRTM_LAT_MIN && p[1] <= SRTM_LAT_MAX)) {
		let minLat = Infinity;
		let maxLat = -Infinity;
		for (const p of track) {
			if (p[1] < minLat) minLat = p[1];
			if (p[1] > maxLat) maxLat = p[1];
		}
		const from = formatLat(minLat);
		const to = formatLat(maxLat);
		throw new Error(
			`Open-Elevation only has data between 56°S and 60°N (SRTM coverage), but this route lies at ${from === to ? from : `${from}–${to}`}. Use Terrain Tiles or Open-Meteo instead.`
		);
	}

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
		const elevations = await fetchOpenMeteoBatch(batch, batchNum, totalBatches, onProgress);
		allElevations.push(...elevations);
	}

	return track.map((point, i) => [point[0], point[1], allElevations[i]]);
}

// ── Open-Meteo batch (GET, 50 points/req) ──

async function fetchOpenMeteoBatch(batch, batchNum, totalBatches, onProgress) {
	const latitudes = batch.map((p) => Math.round(p[1] * 10000) / 10000).join(',');
	const longitudes = batch.map((p) => Math.round(p[0] * 10000) / 10000).join(',');
	const url = `https://api.open-meteo.com/v1/elevation?latitude=${latitudes}&longitude=${longitudes}`;

	for (let attempt = 0; attempt <= OPEN_METEO_MAX_RETRIES; attempt++) {
		if (attempt > 0) {
			const backoff = Math.min(10000 * Math.pow(2, attempt - 1), 60000);
			if (onProgress) onProgress(batchNum, totalBatches, `retry ${attempt}/${OPEN_METEO_MAX_RETRIES}, waiting ${Math.round(backoff / 1000)}s`);
			await delay(backoff);
		}

		let response;
		try {
			response = await fetch(url);
		} catch (err) {
			if (attempt === OPEN_METEO_MAX_RETRIES) {
				throw new Error('Could not reach Open-Meteo. Try a different API.');
			}
			continue;
		}

		if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
			if (attempt === OPEN_METEO_MAX_RETRIES) {
				throw new Error('Open-Meteo rate limit exceeded. Try a different API.');
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

// ── Terrarium (AWS terrain tiles, decoded in the browser) ──
//
// Fetches the PNG elevation tiles the route map already uses for 3D
// terrain and samples them client-side: no API server, no rate limits,
// global coverage (SRTM + ArcticDEM/GMTED above 60°N).

const TERRARIUM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';
const TERRARIUM_ZOOM = 12; // ~15-30 m/px at hiking latitudes, matches the ~30 m source data
const TERRARIUM_TILE_SIZE = 256;
const TERRARIUM_CONCURRENCY = 8;
// Web-mercator tiles only exist between ±85.05°; clamp instead of
// requesting tiles that aren't there.
const MERCATOR_LAT_LIMIT = 85.05;

async function fetchTerrarium(track, onProgress) {
	const worldPx = TERRARIUM_TILE_SIZE * Math.pow(2, TERRARIUM_ZOOM);

	// Continuous global pixel coordinates (web mercator) per track point.
	const pixels = track.map((p) => {
		const lat = Math.max(-MERCATOR_LAT_LIMIT, Math.min(MERCATOR_LAT_LIMIT, p[1]));
		const x = ((p[0] + 180) / 360) * worldPx;
		const y = ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * worldPx;
		return [x, y];
	});

	// Pixel centers sit at half-coordinates, so the 2×2 bilinear window
	// around (x, y) starts at floor(x - 0.5).
	const tileFor = (px, py) => {
		const wrappedX = ((px % worldPx) + worldPx) % worldPx; // across the antimeridian
		const clampedY = Math.max(0, Math.min(worldPx - 1, py));
		return [Math.floor(wrappedX / TERRARIUM_TILE_SIZE), Math.floor(clampedY / TERRARIUM_TILE_SIZE)];
	};

	const tileKeys = new Set();
	for (const [x, y] of pixels) {
		const x0 = Math.floor(x - 0.5);
		const y0 = Math.floor(y - 0.5);
		for (const px of [x0, x0 + 1]) {
			for (const py of [y0, y0 + 1]) {
				const [tx, ty] = tileFor(px, py);
				tileKeys.add(`${tx}/${ty}`);
			}
		}
	}

	// Fetch all needed tiles with limited concurrency.
	const keys = [...tileKeys];
	const tiles = new Map();
	let nextKey = 0;
	let done = 0;
	const worker = async () => {
		while (nextKey < keys.length) {
			const key = keys[nextKey++];
			tiles.set(key, await fetchTerrariumTile(key));
			done++;
			if (onProgress) onProgress(done, keys.length);
		}
	};
	await Promise.all(
		Array.from({ length: Math.min(TERRARIUM_CONCURRENCY, keys.length) }, worker)
	);

	const elevationAt = (px, py) => {
		const [tx, ty] = tileFor(px, py);
		const data = tiles.get(`${tx}/${ty}`);
		const ix = (((px % worldPx) + worldPx) % worldPx) - tx * TERRARIUM_TILE_SIZE;
		const iy = Math.max(0, Math.min(worldPx - 1, py)) - ty * TERRARIUM_TILE_SIZE;
		const i = (iy * TERRARIUM_TILE_SIZE + ix) * 4;
		return data[i] * 256 + data[i + 1] + data[i + 2] / 256 - 32768;
	};

	return track.map((point, idx) => {
		const [x, y] = pixels[idx];
		const x0 = Math.floor(x - 0.5);
		const y0 = Math.floor(y - 0.5);
		const fx = x - 0.5 - x0;
		const fy = y - 0.5 - y0;
		const top = elevationAt(x0, y0) * (1 - fx) + elevationAt(x0 + 1, y0) * fx;
		const bottom = elevationAt(x0, y0 + 1) * (1 - fx) + elevationAt(x0 + 1, y0 + 1) * fx;
		const ele = top * (1 - fy) + bottom * fy;
		return [point[0], point[1], Math.round(ele * 10) / 10];
	});
}

async function fetchTerrariumTile(key) {
	const url = `${TERRARIUM_URL}/${TERRARIUM_ZOOM}/${key}.png`;

	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		if (attempt > 0) await delay(1000 * attempt);

		let response;
		try {
			response = await fetch(url);
		} catch (err) {
			if (attempt === MAX_RETRIES) {
				throw new Error('Could not reach the AWS terrain tile server. Try a different API.');
			}
			continue;
		}

		if (!response.ok) {
			if (attempt === MAX_RETRIES) {
				throw new Error(`Terrain tile server error: ${response.status} ${response.statusText}`);
			}
			continue;
		}

		return decodeTerrariumTile(await response.blob());
	}
}

// Terrarium tiles are plain RGB PNGs (no alpha), so drawing them onto a
// canvas cannot distort the channels via premultiplication.
async function decodeTerrariumTile(blob) {
	const bitmap = await createImageBitmap(blob);
	const canvas =
		typeof OffscreenCanvas !== 'undefined'
			? new OffscreenCanvas(TERRARIUM_TILE_SIZE, TERRARIUM_TILE_SIZE)
			: Object.assign(document.createElement('canvas'), {
					width: TERRARIUM_TILE_SIZE,
					height: TERRARIUM_TILE_SIZE
				});
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	ctx.drawImage(bitmap, 0, 0);
	const { data } = ctx.getImageData(0, 0, TERRARIUM_TILE_SIZE, TERRARIUM_TILE_SIZE);
	if (bitmap.close) bitmap.close();
	return data;
}

function formatLat(lat) {
	return lat >= 0 ? `${lat.toFixed(1)}°N` : `${(-lat).toFixed(1)}°S`;
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

/**
 * Fill missing elevation values by carrying the last known value forward.
 * Leading gaps take the first known value. Tracks with no elevation at all
 * are returned unchanged.
 *
 * @param {Array<[number, number, number?]>} track
 * @returns {Array<[number, number, number?]>}
 */
export function fillElevationGaps(track) {
	const firstKnown = track.find((p) => p[2] != null);
	if (!firstKnown) return track;

	let lastEle = firstKnown[2];
	return track.map((p) => {
		if (p[2] != null) {
			lastEle = p[2];
			return p;
		}
		return [p[0], p[1], lastEle];
	});
}

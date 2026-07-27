<script>
	import { onMount, onDestroy } from 'svelte';
	import { buildColoredSegments, rampToGradient } from './map-colors.js';
	import 'maplibre-gl/dist/maplibre-gl.css';

	let { track, waypoints = [], altWaypoints = [], onClose = null } = $props();

	let mapContainer;
	let map;
	let maplibregl;
	let markers = [];
	let destroyed = false;
	let mapReady = $state(false);
	let mode = $state('elevation');
	let showInfo = $state(false);

	onMount(async () => {
		maplibregl = await import('maplibre-gl');
		// Component may have been destroyed while the bundle was loading
		if (destroyed) return;

		// Compute bounds for the track
		let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
		for (const p of track) {
			if (p[0] < minLon) minLon = p[0];
			if (p[0] > maxLon) maxLon = p[0];
			if (p[1] < minLat) minLat = p[1];
			if (p[1] > maxLat) maxLat = p[1];
		}

		map = new maplibregl.Map({
			container: mapContainer,
			style: {
				version: 8,
				sources: {
					'satellite': {
						type: 'raster',
						tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
						tileSize: 256,
						attribution: '&copy; Esri, Maxar, Earthstar Geographics',
						maxzoom: 19
					},
					'labels': {
						type: 'raster',
						tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
						tileSize: 256,
						maxzoom: 19
					}
				},
				layers: [
					{
						id: 'satellite',
						type: 'raster',
						source: 'satellite',
						minzoom: 0,
						maxzoom: 19
					},
					{
						id: 'labels',
						type: 'raster',
						source: 'labels',
						minzoom: 0,
						maxzoom: 19
					}
				]
			},
			bounds: [[minLon, minLat], [maxLon, maxLat]],
			fitBoundsOptions: { padding: 40 },
			pitch: 45,
			maxPitch: 85,
			maxZoom: 17
		});

		map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

		// Markers are DOM overlays independent of the style, so they can be
		// placed right away — no need to wait for tiles to load.
		mapReady = true;

		map.on('load', () => {
			map.addSource('terrain-dem', {
				type: 'raster-dem',
				tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
				tileSize: 256,
				encoding: 'terrarium',
				maxzoom: 15
			});

			map.setTerrain({ source: 'terrain-dem', exaggeration: 1.5 });

			map.addControl(
				new maplibregl.TerrainControl({ source: 'terrain-dem', exaggeration: 1.5 }),
				'top-right'
			);

			addRouteLayer();
		});
	});

	onDestroy(() => {
		destroyed = true;
		if (map) map.remove();
	});

	function addRouteLayer() {
		if (!map) return;

		const { geojson } = buildColoredSegments(track, mode);

		// Remove existing layers/sources if re-rendering
		if (map.getLayer('route-segments')) map.removeLayer('route-segments');
		if (map.getSource('route-segments')) map.removeSource('route-segments');

		map.addSource('route-segments', { type: 'geojson', data: geojson });
		map.addLayer({
			id: 'route-segments',
			type: 'line',
			source: 'route-segments',
			layout: {
				'line-join': 'round',
				'line-cap': 'round'
			},
			paint: {
				'line-color': ['get', 'color'],
				'line-width': 6,
				'line-opacity': 1
			}
		});
	}

	function addWaypointMarkers() {
		if (!map) return;

		for (const marker of markers) marker.remove();
		markers = [];

		// Ghost markers for non-selected tent spot options first, so the
		// numbered markers of the selected spots stack above them. They are
		// purely informational: label always visible, no popup, clicks pass
		// through to the map.
		for (const wp of altWaypoints) {
			const el = document.createElement('div');
			el.className = 'map-alt-marker';
			const label = document.createElement('span');
			label.className = 'map-alt-marker-label';
			label.textContent = wp.label ?? wp.name;
			el.appendChild(label);

			const marker = new maplibregl.Marker({ element: el })
				.setLngLat([wp.lon, wp.lat])
				.addTo(map);
			markers.push(marker);
		}

		for (let i = 0; i < waypoints.length; i++) {
			const wp = waypoints[i];
			const el = document.createElement('div');
			el.className = 'map-waypoint-marker';
			el.textContent = i + 1;

			const marker = new maplibregl.Marker({ element: el })
				.setLngLat([wp.lon, wp.lat])
				.setPopup(new maplibregl.Popup({ offset: 20, closeButton: false }).setText(wp.name))
				.addTo(map);
			markers.push(marker);
		}
	}

	// Re-place the markers whenever the selected tent spots change while
	// the map is open — otherwise it keeps showing the previous selection.
	$effect(() => {
		waypoints;
		altWaypoints;
		if (mapReady) addWaypointMarkers();
	});

	function switchMode(newMode) {
		mode = newMode;
		addRouteLayer();
	}

	let legendData = $derived(buildColoredSegments(track, mode).legend);
	let gradientCSS = $derived(rampToGradient(legendData.ramp));
</script>

<div class="route-map-wrapper">
	<div class="map-container" bind:this={mapContainer}></div>

	<div class="map-footer">
		{#if onClose}
			<button class="map-close-btn" onclick={onClose}>Hide Map</button>
		{/if}
		<div class="map-footer-toggles">
			<button
				class="map-toggle-btn"
				class:map-toggle-btn--active={mode === 'elevation'}
				onclick={() => switchMode('elevation')}
				disabled={mode === 'elevation'}
			>
				Elevation
			</button>
			<button
				class="map-toggle-btn"
				class:map-toggle-btn--active={mode === 'slope'}
				onclick={() => switchMode('slope')}
				disabled={mode === 'slope'}
			>
				Steepness
			</button>
			<button class="map-info-icon" onclick={() => showInfo = !showInfo}>ⓘ</button>
			{#if showInfo}
				<div class="map-info-popup">
					<strong>Elevation</strong> — altitude above sea level. Colors range from the lowest to the highest point on the route.
					<br /><strong>Steepness</strong> — gradient between track points. Blue = downhill, green = flat, warm colors = uphill.
				</div>
			{/if}
		</div>
		<div class="map-footer-legend">
			<div class="map-legend-bar" style="background: {gradientCSS}"></div>
			<div class="map-legend-labels">
				{#if mode === 'elevation'}
					<span>Low · {legendData.min}{legendData.unit}</span>
					<span>High · {legendData.max}{legendData.unit}</span>
				{:else}
					<span>Downhill · {legendData.min}{legendData.unit}</span>
					<span>Flat</span>
					<span>Uphill · {legendData.max}{legendData.unit}</span>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.route-map-wrapper {
		width: calc(100vw - 2rem);
		max-width: 1400px;
		position: relative;
		left: 50%;
		transform: translateX(-50%);
		border-radius: 12px;
		overflow: hidden;
		border: 1px solid rgba(210, 201, 160, 0.08);
		margin: 0.5rem 0;
		animation: mapFadeIn 0.3s ease;
	}

	@keyframes mapFadeIn {
		from { opacity: 0; transform: translateY(6px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.map-container {
		width: 100%;
		height: min(70vh, 700px);
	}

	@media (max-width: 768px) {
		.route-map-wrapper {
			width: calc(100vw - 1rem);
			border-radius: 8px;
		}

		.map-container {
			height: min(60vh, 450px);
		}
	}

	/* ── Footer (toggles + legend) ── */

	.map-footer {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.75rem;
		background: rgba(2, 45, 24, 0.55);
	}

	.map-close-btn {
		padding: 0.3rem 0.7rem;
		font-size: 0.82rem;
		font-weight: 600;
		font-family: 'Karla', system-ui, sans-serif;
		color: rgba(210, 201, 160, 0.5);
		background: transparent;
		border: 1.5px solid rgba(210, 201, 160, 0.12);
		border-radius: 7px;
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.map-close-btn:hover {
		color: rgba(210, 201, 160, 0.8);
		border-color: rgba(210, 201, 160, 0.25);
	}

	.map-toggle-btn {
		padding: 0.3rem 0.7rem;
		font-size: 0.82rem;
		font-weight: 600;
		font-family: 'Karla', system-ui, sans-serif;
		color: rgba(210, 201, 160, 0.6);
		background: transparent;
		border: 1.5px solid rgba(210, 201, 160, 0.1);
		border-radius: 7px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.map-toggle-btn:hover:not(:disabled) {
		color: rgba(210, 201, 160, 0.7);
		border-color: rgba(210, 201, 160, 0.2);
	}

	.map-toggle-btn--active {
		color: #FAAD17;
		border-color: rgba(250, 173, 23, 0.35);
		background: rgba(250, 173, 23, 0.06);
	}

	.map-toggle-btn--active:hover:not(:disabled) {
		color: #FAAD17;
		border-color: rgba(250, 173, 23, 0.5);
	}

	.map-toggle-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.map-footer-toggles {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		flex-shrink: 0;
		position: relative;
	}

	.map-info-icon {
		background: transparent;
		border: none;
		color: rgba(210, 201, 160, 0.4);
		font-size: 0.85rem;
		cursor: pointer;
		padding: 0 0.15rem;
		transition: color 0.15s ease;
	}

	.map-info-icon:hover {
		color: rgba(210, 201, 160, 0.7);
	}

	.map-info-popup {
		position: absolute;
		left: 0;
		bottom: calc(100% + 0.4rem);
		z-index: 10;
		background: #1a3a2a;
		border: 1px solid rgba(210, 201, 160, 0.15);
		border-radius: 8px;
		padding: 0.6rem 0.8rem;
		font-size: 0.75rem;
		font-weight: 400;
		line-height: 1.6;
		color: rgba(210, 201, 160, 0.7);
		white-space: nowrap;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
	}

	.map-info-popup strong {
		color: #D2C9A0;
	}

	.map-footer-legend {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
		min-width: 0;
	}

	.map-legend-bar {
		width: 100%;
		height: 5px;
		border-radius: 3px;
	}

	.map-legend-labels {
		display: flex;
		justify-content: space-between;
		font-size: 0.68rem;
		font-weight: 500;
		color: rgba(210, 201, 160, 0.45);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	/* ── Waypoint markers ── */

	:global(.map-waypoint-marker) {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: #D4719A;
		color: #fff;
		font-size: 0.65rem;
		font-weight: 700;
		font-family: 'Karla', system-ui, sans-serif;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px solid rgba(255, 255, 255, 0.8);
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
		cursor: pointer;
	}

	/* No position property here — MapLibre's own .maplibregl-marker class
	   must keep position:absolute, or markers drift out of geo-sync. */
	:global(.map-alt-marker) {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: rgba(2, 45, 24, 0.55);
		border: 3px solid #D4719A;
		box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.8), 0 2px 6px rgba(0, 0, 0, 0.3);
		pointer-events: none;
	}

	:global(.map-alt-marker-label) {
		position: absolute;
		left: calc(100% + 6px);
		top: 50%;
		transform: translateY(-50%);
		font-size: 0.7rem;
		font-weight: 700;
		font-family: 'Karla', system-ui, sans-serif;
		color: #fff;
		background: rgba(2, 45, 24, 0.7);
		padding: 1px 6px;
		border-radius: 5px;
		white-space: nowrap;
	}

	:global(.maplibregl-popup-content) {
		background: #1a3a2a;
		color: #D2C9A0;
		font-family: 'Karla', system-ui, sans-serif;
		font-size: 0.82rem;
		font-weight: 600;
		padding: 0.4rem 0.65rem;
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
	}

	:global(.maplibregl-popup-tip) {
		border-top-color: #1a3a2a;
	}
</style>

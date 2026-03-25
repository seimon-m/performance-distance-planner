<script>
	import { parseFile } from '$lib/gpx.js';
	import { computeStages } from '$lib/calc.js';
	import { stagesToCSV, downloadCSV } from '$lib/csv.js';
	import { fetchElevation, hasElevationData, PROVIDERS } from '$lib/elevation.js';
	import { getAppState } from '$lib/store.svelte.js';

	const app = getAppState();

	async function processFile(file) {
		if (!file) return;
		app.error = '';
		app.stages = [];
		app.filename = file.name;
		app.loading = true;

		try {
			app.loadingMessage = 'Parsing file…';
			const text = await file.text();
			let { track, waypoints } = parseFile(text, file.name);

			app.currentRawTrack = track;
			app.currentWaypoints = waypoints;

			if (!hasElevationData(track)) {
				app.loadingMessage = `Fetching elevation data (${track.length} points)…`;
				track = await fetchElevation(track, app.elevationProvider, (batch, total, status) => {
					app.loadingMessage = status
						? `Elevation batch ${batch}/${total} — ${status}…`
						: `Fetching elevation data (batch ${batch}/${total})…`;
				});
			}

			app.currentTrack = track;
			app.stages = computeStages(track, waypoints, app.ascentDivisor, app.descentDivisor);
		} catch (err) {
			app.error = err.message || 'Error processing file.';
			app.stages = [];
		} finally {
			app.loading = false;
			app.loadingMessage = '';
		}
	}

	async function refetchElevation(provider) {
		if (!app.currentRawTrack || !app.currentWaypoints) return;
		app.elevationProvider = provider;
		app.error = '';
		app.loading = true;

		try {
			const raw = app.currentRawTrack;
			app.loadingMessage = `Fetching elevation data (${raw.length} points)…`;
			const track = await fetchElevation(raw, provider, (batch, total, status) => {
				app.loadingMessage = status
					? `Elevation batch ${batch}/${total} — ${status}…`
					: `Fetching elevation data (batch ${batch}/${total})…`;
			});

			app.currentTrack = track;
			app.stages = computeStages(track, app.currentWaypoints, app.ascentDivisor, app.descentDivisor);
		} catch (err) {
			app.error = err.message || 'Error fetching elevation data.';
			app.stages = [];
		} finally {
			app.loading = false;
			app.loadingMessage = '';
		}
	}

	function handleFileUpload(event) {
		processFile(event.target.files?.[0]);
	}

	function handleDrop(event) {
		event.preventDefault();
		app.dragging = false;
		const file = event.dataTransfer?.files?.[0];
		if (file && (file.name.endsWith('.gpx') || file.name.endsWith('.kml'))) {
			processFile(file);
		}
	}

	function handleDragOver(event) {
		event.preventDefault();
		app.dragging = true;
	}

	function handleDragLeave() {
		app.dragging = false;
	}

	function exportCSV() {
		const csv = stagesToCSV(app.stages);
		downloadCSV(csv);
	}

	function recalculate() {
		if (app.currentTrack && app.currentWaypoints) {
			app.stages = computeStages(app.currentTrack, app.currentWaypoints, app.ascentDivisor, app.descentDivisor);
		}
	}

	let totalDistance = $derived(
		app.stages.reduce((sum, s) => sum + s.distance, 0)
	);
	let totalAscent = $derived(
		app.stages.reduce((sum, s) => sum + s.ascent, 0)
	);
	let totalDescent = $derived(
		app.stages.reduce((sum, s) => sum + s.descent, 0)
	);
	let totalPerformanceKm = $derived(
		app.stages.reduce((sum, s) => sum + s.performanceKm, 0)
	);

	let snapTooltipOpen = $state(false);
	let densityTooltipOpen = $state(false);
</script>

<main>
	<header>
		<h1>Performance Distance Planner</h1>
		<p class="subtitle">Get daily stages and performance kilometers from your Google Earth route</p>
		<a href="/info" class="info-btn">How it works</a>
	</header>

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<label
		class="dropzone"
		class:dropzone--active={app.dragging}
		class:dropzone--has-file={!!app.filename}
		class:dropzone--loading={app.loading}
		for="gpx-upload"
		ondrop={handleDrop}
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
	>
		{#if app.loading}
			<span class="dropzone-spinner"></span>
			<span class="dropzone-text">{app.loadingMessage}</span>
		{:else if app.filename}
			<span class="dropzone-icon">✓</span>
			<span class="dropzone-text">{app.filename}</span>
			<span class="dropzone-hint">Choose a different file</span>
		{:else}
			<span class="dropzone-icon">↑</span>
			<span class="dropzone-text">Drag GPX / KML here</span>
			<span class="dropzone-hint">or click to browse</span>
		{/if}
		<input
			id="gpx-upload"
			type="file"
			accept=".gpx,.kml"
			onchange={handleFileUpload}
		/>
	</label>

	<div class="api-toggle">
		<span class="api-toggle-label">Elevation API</span>
		{#each Object.entries(PROVIDERS) as [key, provider]}
			<button
				class="api-toggle-btn"
				class:api-toggle-btn--active={app.elevationProvider === key}
				onclick={() => app.currentRawTrack ? refetchElevation(key) : app.elevationProvider = key}
				disabled={app.loading || app.elevationProvider === key}
			>
				{provider.name}
			</button>
		{/each}
	</div>

	{#if app.error}
		<div class="error" role="alert">
			<span class="error-icon">!</span>
			{app.error}
		</div>
	{/if}

	{#if app.stages.length > 0}
		<div class="results">
			<div class="results-header">
				<h2>{app.stages.length} Stages</h2>
			</div>

			<div class="formula-bar">
				<span class="formula-label">Lkm</span>
				<span class="formula-eq">=</span>
				<span class="formula-part">Distance <span class="formula-unit">(km)</span></span>
				<span class="formula-op">+</span>
				<span class="formula-part">Ascent <span class="formula-unit">(in <input
					id="ascent-divisor"
					type="number"
					min="1"
					step="1"
					value={app.ascentDivisor}
					oninput={(e) => { app.ascentDivisor = +e.target.value; recalculate(); }}
				/>m)</span></span>
				{#if app.descentDivisor > 0}
					<span class="formula-op">+</span>
					<span class="formula-part">Descent <span class="formula-unit">(in <input
						id="descent-divisor"
						type="number"
						min="0"
						step="1"
						value={app.descentDivisor}
						oninput={(e) => { app.descentDivisor = +e.target.value; recalculate(); }}
					/>m)</span></span>
				{/if}
				<button class="toggle-descent" onclick={() => { app.descentDivisor = app.descentDivisor > 0 ? 0 : 150; recalculate(); }}>
					{app.descentDivisor > 0 ? '− Descent' : '+ Descent'}
				</button>
			</div>

			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th>Day</th>
							<th class="num">km</th>
							<th class="num">hm ↑</th>
							<th class="num">hm ↓</th>
							<th class="num snap-col">
								<span class="snap-header">
									Snap
									<button class="snap-info-btn" onclick={() => snapTooltipOpen = !snapTooltipOpen} aria-label="Snap info">
										ⓘ
									</button>
								</span>
								{#if snapTooltipOpen}
									<div class="snap-tooltip">
										Distance from waypoint to nearest track point.
										<br /><span class="snap-dot snap-green"></span> ≤ 100 m — precise
										<br /><span class="snap-dot snap-yellow"></span> ≤ 400 m — acceptable
										<br /><span class="snap-dot snap-red"></span> > 400 m — check placement
									</div>
								{/if}
							</th>
							<th class="num snap-col">
								<span class="snap-header">
									Density
									<button class="snap-info-btn" onclick={() => densityTooltipOpen = !densityTooltipOpen} aria-label="Density info">
										ⓘ
									</button>
								</span>
								{#if densityTooltipOpen}
									<div class="snap-tooltip">
										Avg. distance between consecutive track points.
										<br /><span class="snap-dot snap-green"></span> ≤ 50 m — dense, accurate
										<br /><span class="snap-dot snap-yellow"></span> ≤ 150 m — moderate
										<br /><span class="snap-dot snap-red"></span> > 150 m — sparse, less accurate
									</div>
								{/if}
							</th>
							<th class="num">Lkm</th>
						</tr>
					</thead>
					<tbody>
						{#each app.stages as stage, i}
							<tr style="--delay: {i * 30}ms">
								<td class="day">Day {stage.day}</td>
								<td class="num">{stage.distance.toFixed(1)}</td>
								<td class="num">{stage.ascent}</td>
								<td class="num">{stage.descent}</td>
								<td class="num snap-cell">
									{#if stage.snapDistance != null}
										<span
											class="snap-dot"
											class:snap-green={stage.snapDistance <= 100}
											class:snap-yellow={stage.snapDistance > 100 && stage.snapDistance <= 400}
											class:snap-red={stage.snapDistance > 400}
										></span>
										<span class="snap-val">{stage.snapDistance}m</span>
									{:else}
										<span class="snap-na">—</span>
									{/if}
								</td>
								<td class="num snap-cell">
									{#if stage.pointDensity != null}
										<span
											class="snap-dot"
											class:snap-green={stage.pointDensity <= 50}
											class:snap-yellow={stage.pointDensity > 50 && stage.pointDensity <= 150}
											class:snap-red={stage.pointDensity > 150}
										></span>
										<span class="snap-val">{stage.pointDensity}m</span>
									{:else}
										<span class="snap-na">—</span>
									{/if}
								</td>
								<td class="num lkm">{stage.performanceKm.toFixed(1)}</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr>
							<td class="day">Total</td>
							<td class="num">{totalDistance.toFixed(1)}</td>
							<td class="num">{totalAscent}</td>
							<td class="num">{totalDescent}</td>
							<td class="num snap-cell"></td>
							<td class="num snap-cell"></td>
							<td class="num lkm">{totalPerformanceKm.toFixed(1)}</td>
						</tr>
					</tfoot>
				</table>
			</div>

			<button class="export-btn" onclick={exportCSV}>
				Export CSV
			</button>
		</div>
	{/if}
</main>

<style>
	:global(*) {
		box-sizing: border-box;
	}

	:global(body) {
		font-family: 'Karla', system-ui, sans-serif;
		background: #022D18;
		color: #D2C9A0;
		margin: 0;
		padding: 0;
		-webkit-font-smoothing: antialiased;
	}

	main {
		max-width: 620px;
		margin: 0 auto;
		padding: 4rem 1.25rem 5rem;
	}

	/* ── Header ── */

	header {
		margin-bottom: 2rem;
	}

	h1 {
		font-size: 2rem;
		font-weight: 800;
		color: #D4719A;
		margin: 0 0 0.2rem;
		letter-spacing: -0.02em;
	}

	.subtitle {
		color: rgba(210, 201, 160, 0.7);
		margin: 0;
		font-size: 1.1rem;
		font-weight: 400;
		letter-spacing: 0.01em;
	}

	.info-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.75rem;
		padding: 0.55rem 1.1rem;
		background: transparent;
		color: #D4719A;
		border: 1.5px solid rgba(212, 113, 154, 0.3);
		border-radius: 9px;
		font-size: 0.9rem;
		font-weight: 600;
		font-family: 'Karla', system-ui, sans-serif;
		text-decoration: none;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.info-btn:hover {
		background: rgba(212, 113, 154, 0.08);
		border-color: #D4719A;
	}

	.info-btn:active {
		transform: scale(0.97);
	}

	/* ── Dropzone ── */

	.dropzone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		width: 100%;
		padding: 2.5rem 1.5rem;
		border: 1.5px dashed rgba(210, 201, 160, 0.2);
		border-radius: 16px;
		background: rgba(210, 201, 160, 0.03);
		cursor: pointer;
		transition: all 0.2s ease;
		margin-bottom: 1.25rem;
	}

	.dropzone:hover {
		border-color: rgba(210, 201, 160, 0.35);
		background: rgba(210, 201, 160, 0.05);
	}

	.dropzone--active {
		border-color: #D4719A;
		background: rgba(212, 113, 154, 0.06);
		border-style: solid;
	}

	.dropzone--has-file {
		border-style: solid;
		border-color: rgba(210, 201, 160, 0.15);
		padding: 1.5rem;
	}

	.dropzone--loading {
		border-style: solid;
		border-color: rgba(250, 173, 23, 0.3);
		pointer-events: none;
	}

	.dropzone-icon {
		font-size: 1.1rem;
		font-weight: 700;
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: rgba(210, 201, 160, 0.1);
		color: #D2C9A0;
		margin-bottom: 0.25rem;
	}

	.dropzone--has-file .dropzone-icon {
		background: rgba(212, 113, 154, 0.15);
		color: #D4719A;
	}

	.dropzone-text {
		font-size: 1rem;
		font-weight: 600;
		color: #D2C9A0;
	}

	.dropzone--loading .dropzone-text {
		color: rgba(210, 201, 160, 0.6);
		font-weight: 400;
	}

	.dropzone-hint {
		font-size: 0.85rem;
		color: rgba(210, 201, 160, 0.3);
		font-weight: 400;
	}

	.dropzone-spinner {
		width: 1.5rem;
		height: 1.5rem;
		border: 2px solid rgba(250, 173, 23, 0.2);
		border-top-color: #FAAD17;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
		margin-bottom: 0.35rem;
	}

	.dropzone input[type='file'] {
		display: none;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* ── API Toggle ── */

	.api-toggle {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-bottom: 1.25rem;
	}

	.api-toggle-label {
		font-size: 0.85rem;
		font-weight: 500;
		color: rgba(210, 201, 160, 0.4);
		margin-right: 0.25rem;
	}

	.api-toggle-btn {
		padding: 0.3rem 0.7rem;
		font-size: 0.82rem;
		font-weight: 600;
		font-family: 'Karla', system-ui, sans-serif;
		color: rgba(210, 201, 160, 0.45);
		background: transparent;
		border: 1.5px solid rgba(210, 201, 160, 0.1);
		border-radius: 7px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.api-toggle-btn:hover:not(:disabled) {
		color: rgba(210, 201, 160, 0.7);
		border-color: rgba(210, 201, 160, 0.2);
	}

	.api-toggle-btn--active {
		color: #FAAD17;
		border-color: rgba(250, 173, 23, 0.35);
		background: rgba(250, 173, 23, 0.06);
	}

	.api-toggle-btn--active:hover:not(:disabled) {
		color: #FAAD17;
		border-color: rgba(250, 173, 23, 0.5);
	}

	.api-toggle-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	/* ── Error ── */

	.error {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		background: rgba(218, 107, 39, 0.08);
		color: #DA6B27;
		border-radius: 12px;
		padding: 0.85rem 1rem;
		margin-bottom: 1.25rem;
		font-size: 0.95rem;
		line-height: 1.45;
	}

	.error-icon {
		flex-shrink: 0;
		width: 1.3rem;
		height: 1.3rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: rgba(218, 107, 39, 0.18);
		font-size: 0.7rem;
		font-weight: 800;
	}

	/* ── Results ── */

	.results {
		animation: fadeUp 0.3s ease;
	}

	@keyframes fadeUp {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.results-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 0.75rem;
		gap: 1rem;
		flex-wrap: wrap;
	}

	h2 {
		font-size: 1.35rem;
		font-weight: 700;
		color: #D2C9A0;
		margin: 0;
		letter-spacing: -0.01em;
	}

	.formula-bar {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin-bottom: 0.85rem;
		font-size: 0.9rem;
		color: rgba(210, 201, 160, 0.5);
	}

	.formula-label {
		font-weight: 700;
		color: #FAAD17;
		font-size: 0.92rem;
	}

	.formula-eq {
		color: rgba(210, 201, 160, 0.3);
	}

	.formula-part {
		color: rgba(210, 201, 160, 0.65);
	}

	.formula-op {
		color: rgba(210, 201, 160, 0.3);
		padding: 0 0.05rem;
	}

	.formula-unit {
		color: rgba(210, 201, 160, 0.35);
	}

	.formula-bar input {
		width: 2.6rem;
		padding: 0.15rem 0.25rem;
		border: none;
		border-bottom: 1.5px solid rgba(210, 201, 160, 0.2);
		border-radius: 0;
		font-size: 0.92rem;
		font-family: 'Karla', system-ui, sans-serif;
		font-weight: 700;
		text-align: center;
		font-variant-numeric: tabular-nums;
		background: transparent;
		color: #D2C9A0;
		transition: border-color 0.15s;
	}

	.formula-bar input:focus {
		outline: none;
		border-bottom-color: #D4719A;
	}

	.formula-bar input::-webkit-inner-spin-button,
	.formula-bar input::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.formula-bar input[type='number'] {
		-moz-appearance: textfield;
		appearance: textfield;
	}

	.toggle-descent {
		background: none;
		border: 1px solid rgba(210, 201, 160, 0.12);
		border-radius: 6px;
		color: rgba(210, 201, 160, 0.4);
		font-size: 0.78rem;
		font-family: 'Karla', system-ui, sans-serif;
		font-weight: 600;
		padding: 0.2rem 0.5rem;
		cursor: pointer;
		transition: all 0.15s;
		margin-left: 0.15rem;
	}

	.toggle-descent:hover {
		color: #D4719A;
		border-color: rgba(212, 113, 154, 0.3);
	}

	/* ── Table ── */

	.table-wrap {
		border-radius: 12px;
		overflow: hidden;
		border: 1px solid rgba(210, 201, 160, 0.08);
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th {
		background: rgba(21, 89, 118, 0.3);
		color: rgba(210, 201, 160, 0.55);
		padding: 0.6rem 0.85rem;
		text-align: left;
		font-weight: 600;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	td {
		padding: 0.55rem 0.85rem;
		border-bottom: 1px solid rgba(210, 201, 160, 0.05);
		font-size: 0.95rem;
		color: rgba(210, 201, 160, 0.8);
	}

	.day {
		font-weight: 600;
		color: #D2C9A0;
	}

	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.lkm {
		color: #FAAD17;
		font-weight: 600;
	}

	tbody tr {
		transition: background 0.12s;
		animation: fadeUp 0.25s ease both;
		animation-delay: var(--delay, 0ms);
	}

	tbody tr:hover {
		background: rgba(210, 201, 160, 0.04);
	}

	tfoot td {
		border-top: 1px solid rgba(210, 201, 160, 0.1);
		border-bottom: none;
		font-weight: 700;
		color: #D2C9A0;
		padding-top: 0.65rem;
		padding-bottom: 0.65rem;
	}

	tfoot .lkm {
		color: #FAAD17;
	}

	/* ── Snap indicator ── */

	.snap-col {
		position: relative;
	}

	.snap-header {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}

	.snap-info-btn {
		background: none;
		border: none;
		color: rgba(210, 201, 160, 0.4);
		font-size: 0.85rem;
		cursor: pointer;
		padding: 0;
		line-height: 1;
		transition: color 0.15s;
	}

	.snap-info-btn:hover {
		color: #D4719A;
	}

	.snap-tooltip {
		position: absolute;
		right: 0;
		top: 100%;
		z-index: 10;
		background: #1a3a2a;
		border: 1px solid rgba(210, 201, 160, 0.15);
		border-radius: 8px;
		padding: 0.6rem 0.8rem;
		font-size: 0.75rem;
		font-weight: 400;
		text-transform: none;
		letter-spacing: 0;
		line-height: 1.6;
		color: rgba(210, 201, 160, 0.7);
		white-space: nowrap;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
	}

	.snap-cell {
		white-space: nowrap;
	}

	.snap-cell .snap-dot {
		margin-right: 0.25rem;
	}

	.snap-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		vertical-align: middle;
	}

	.snap-green { background: #4ade80; }
	.snap-yellow { background: #facc15; }
	.snap-red { background: #f87171; }

	.snap-val {
		font-size: 0.75rem;
		color: rgba(210, 201, 160, 0.45);
		vertical-align: middle;
	}

	.snap-na {
		color: rgba(210, 201, 160, 0.2);
	}

	/* ── Export button ── */

	.export-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		margin-top: 1rem;
		padding: 0.55rem 1.1rem;
		background: transparent;
		color: #D4719A;
		border: 1.5px solid rgba(212, 113, 154, 0.3);
		border-radius: 9px;
		font-size: 0.9rem;
		font-weight: 600;
		font-family: 'Karla', system-ui, sans-serif;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.export-btn:hover {
		background: rgba(212, 113, 154, 0.08);
		border-color: #D4719A;
	}

	.export-btn:active {
		transform: scale(0.97);
	}
</style>

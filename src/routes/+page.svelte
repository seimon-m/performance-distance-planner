<script>
	import { parseFile, selectStageWaypoints } from '$lib/gpx.js';
	import { computeStages, sortWaypointsAlongTrack, walkingTime, formatDuration } from '$lib/calc.js';
	import { stagesToCSV, downloadCSV } from '$lib/csv.js';
	import { fetchElevation, hasElevationData, fillElevationGaps, PROVIDERS } from '$lib/elevation.js';
	import { getAppState } from '$lib/store.svelte.js';
	import StageChart from '$lib/StageChart.svelte';

	const app = getAppState();
	let showMap = $state(false);
	let RouteMap = $state(null);

	async function revealMap() {
		showMap = true;
		if (!RouteMap) {
			RouteMap = (await import('$lib/RouteMap.svelte')).default;
		}
	}

	async function processFile(file) {
		if (!file) return;
		app.error = '';
		app.notice = '';
		app.stages = [];
		showMap = false;
		app.filename = file.name;
		app.loading = true;

		try {
			app.loadingMessage = 'Parsing file…';
			const text = await file.text();
			let { track, waypoints, stageGroups } = parseFile(text, file.name);

			app.currentRawTrack = track;
			app.currentWaypoints = waypoints;
			app.stageGroups = stageGroups;
			app.selectedVariants = {};

			if (!hasElevationData(track)) {
				app.loadingMessage = `Fetching elevation data (${track.length} points)…`;
				track = await fetchElevation(track, app.elevationProvider, (batch, total, status) => {
					app.loadingMessage = status
						? `Elevation batch ${batch}/${total} — ${status}…`
						: `Fetching elevation data (batch ${batch}/${total})…`;
				});
				if (!hasElevationData(track)) {
					app.error = 'Elevation API returned no data. Try a different Elevation API.';
				}
			}

			app.currentTrack = fillElevationGaps(track);
			app.stages = computeStages(app.currentTrack, waypoints, app.ascentDivisor, app.descentDivisor);
			app.notice = checkWaypointNotices(app.currentTrack, waypoints);
		} catch (err) {
			app.error = err.message || 'Error processing file.';
			app.stages = [];
		} finally {
			app.loading = false;
			app.loadingMessage = '';
		}
	}

	/**
	 * A waypoint this far from the route probably lies on a side spur the
	 * track doesn't follow — measurements along the track won't reflect it.
	 */
	const FAR_SNAP_METERS = 500;

	/**
	 * Warn about waypoint situations that silently skew the results:
	 * - two stage waypoints snapping to the same track point (stages get merged)
	 * - waypoints far away from the route (stats around them are unreliable)
	 */
	function checkWaypointNotices(track, waypoints) {
		if (waypoints.length === 0) return '';
		const sorted = sortWaypointsAlongTrack(waypoints, track);
		const messages = [];

		const uniqueIndices = new Set(sorted.map((wp) => wp.trackIndex));
		if (uniqueIndices.size < sorted.length) {
			const merged = sorted.length - uniqueIndices.size;
			messages.push(`${merged} stage waypoint${merged === 1 ? '' : 's'} snapped to the same track point as another — the affected days were merged into one stage. Check that consecutive waypoints sit at distinct spots along the route.`);
		}

		const far = sorted.filter((wp) => wp.snapDistance > FAR_SNAP_METERS);
		if (far.length > 0) {
			const names = far.map((wp) => `${wp.name} (${Math.round(wp.snapDistance)} m)`).join(', ');
			messages.push(`${names} ${far.length === 1 ? 'is' : 'are'} far from the route. All measurements follow the track, so the extra way to ${far.length === 1 ? 'this spot' : 'these spots'} is not included.`);
		}

		return messages.join(' ');
	}

	/**
	 * Pick a different tent spot for a night and redistribute the two
	 * adjacent days accordingly.
	 */
	function selectTentSpot(stageNum, variant) {
		app.selectedVariants = { ...app.selectedVariants, [stageNum]: variant };
		app.currentWaypoints = selectStageWaypoints(app.stageGroups, app.selectedVariants);
		recalculate();
		app.notice = checkWaypointNotices(app.currentTrack, app.currentWaypoints);
	}

	async function refetchElevation(provider) {
		if (!app.currentRawTrack || !app.currentWaypoints) return;
		const previousProvider = app.elevationProvider;
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

			app.currentTrack = fillElevationGaps(track);
			app.stages = computeStages(app.currentTrack, app.currentWaypoints, app.ascentDivisor, app.descentDivisor);
		} catch (err) {
			// Keep the existing results — they still match the previous provider
			app.error = err.message || 'Error fetching elevation data.';
			app.elevationProvider = previousProvider;
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
		const name = file?.name.toLowerCase() ?? '';
		if (file && (name.endsWith('.gpx') || name.endsWith('.kml'))) {
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
		const csv = stagesToCSV(stagesWithTime);
		downloadCSV(csv);
	}

	function recalculate() {
		if (app.currentTrack && app.currentWaypoints) {
			app.stages = computeStages(app.currentTrack, app.currentWaypoints, app.ascentDivisor, app.descentDivisor);
		}
	}

	/**
	 * Update a divisor from an input field, ignoring empty/invalid values —
	 * a cleared field would otherwise become 0 and divide by zero.
	 */
	function setDivisor(key, rawValue) {
		const v = Math.floor(+rawValue);
		if (!Number.isFinite(v) || v < 1) return;
		app[key] = v;
		recalculate();
	}

	/**
	 * Update a walking-time parameter, allowing decimals (e.g. 4.2 km/h)
	 * but ignoring empty/invalid values to avoid division by zero.
	 */
	function setSpeedParam(key, rawValue) {
		const v = +rawValue;
		if (!Number.isFinite(v) || v <= 0) return;
		app[key] = v;
	}

	// Nights that have more than one tent spot option
	let variantNights = $derived(app.stageGroups.filter((g) => g.variants.length > 1));
	let hasNonDefaultSpots = $derived(
		variantNights.some((g) => selectedVariantOf(g.stageNum) !== g.variants[0].variant)
	);

	// Night rows rendered inside the table, keyed by the day they follow.
	// Chips are ordered by position along the route (not by priority), so
	// the row reads like the track: earlier spots left, later spots right.
	let nightGroups = $derived(
		new Map(
			variantNights.map((g) => [
				g.stageNum,
				app.currentTrack
					? { ...g, variants: sortWaypointsAlongTrack(g.variants, app.currentTrack) }
					: g
			])
		)
	);

	function selectedVariantOf(stageNum) {
		const group = app.stageGroups.find((g) => g.stageNum === stageNum);
		if (!group) return '';
		const wanted = app.selectedVariants[stageNum];
		return group.variants.some((v) => v.variant === wanted) ? wanted : group.variants[0].variant;
	}

	// Stages with every night at its preferred spot — the baseline the
	// tent spot deltas are measured against.
	let defaultStages = $derived(
		hasNonDefaultSpots && app.currentTrack
			? computeStages(app.currentTrack, selectStageWaypoints(app.stageGroups), app.ascentDivisor, app.descentDivisor)
			: null
	);

	/**
	 * Human-readable difference vs the default spots for the two days a
	 * night's tent spot touches, one entry per affected day. Only meaningful
	 * while day numbering is in sync, so bail out if the stage counts
	 * diverge (e.g. after a merge).
	 */
	function nightDelta(stageNum) {
		if (!defaultStages || defaultStages.length !== app.stages.length) return null;
		const parts = [];
		for (const day of [stageNum, stageNum + 1]) {
			const cur = app.stages[day - 1];
			const def = defaultStages[day - 1];
			if (!cur || !def) continue;
			const dKm = cur.distance - def.distance;
			const dUp = cur.ascent - def.ascent;
			const dTime =
				walkingTime(cur.distance, cur.ascent, cur.descent, app.baseSpeed, app.ascentRate, app.descentRate) -
				walkingTime(def.distance, def.ascent, def.descent, app.baseSpeed, app.ascentRate, app.descentRate);
			const bits = [];
			if (Math.abs(dKm) >= 0.05) bits.push(`${signed(dKm.toFixed(1))} km`);
			if (Math.abs(dUp) >= 1) bits.push(`${signed(Math.round(dUp))} hm↑`);
			if (Math.abs(dTime) >= 1 / 60) bits.push(`${dTime >= 0 ? '+' : '−'}${formatDuration(Math.abs(dTime))} h`);
			// ↑ points at the day row above the night row, ↓ at the one below
			const arrow = day === stageNum ? '↑' : '↓';
			if (bits.length > 0) parts.push(`${arrow} Day ${day} ${bits.join(' / ')}`);
		}
		return parts.length > 0 ? parts : ['no change (same track point)'];
	}

	function signed(v) {
		return +v >= 0 ? `+${v}` : `−${String(v).slice(1)}`;
	}

	// All-zero elevation (e.g. failed API fetch) makes ascent/descent, Lkm
	// and Time silently misleading — flag it instead.
	let noElevation = $derived(
		app.stages.length > 0 && app.currentTrack != null && !hasElevationData(app.currentTrack)
	);

	// Walking time is derived from the per-stage values, so speed changes
	// don't need a full track re-walk.
	let stagesWithTime = $derived(
		app.stages.map((s) => ({
			...s,
			walkingTime: walkingTime(s.distance, s.ascent, s.descent, app.baseSpeed, app.ascentRate, app.descentRate)
		}))
	);

	let totalWalkingTime = $derived(
		stagesWithTime.reduce((sum, s) => sum + s.walkingTime, 0)
	);

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

	let densityTooltipOpen = $state(false);
	let timeTooltipOpen = $state(false);
</script>

<main>
	<header>
		<h1>Route Checker</h1>
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

	{#if app.notice}
		<div class="notice" role="status">
			<span class="notice-icon">!</span>
			{app.notice}
		</div>
	{/if}

	{#if app.stages.length > 0}
		<div class="results">
			<div class="results-header">
				<h2>{app.stages.length} {app.stages.length === 1 ? 'Stage' : 'Stages'}</h2>
				<span class="track-points">{app.currentTrack.length} track points</span>
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
					oninput={(e) => setDivisor('ascentDivisor', e.target.value)}
				/>m)</span></span>
				{#if app.descentDivisor > 0}
					<span class="formula-op">+</span>
					<span class="formula-part">Descent <span class="formula-unit">(in <input
						id="descent-divisor"
						type="number"
						min="1"
						step="1"
						value={app.descentDivisor}
						oninput={(e) => setDivisor('descentDivisor', e.target.value)}
					/>m)</span></span>
				{/if}
				<button class="toggle-descent" onclick={() => { app.descentDivisor = app.descentDivisor > 0 ? 0 : 150; recalculate(); }}>
					{app.descentDivisor > 0 ? '− Descent' : '+ Descent'}
				</button>
			</div>

			<div class="formula-bar">
				<span class="formula-label formula-label--time">Time</span>
				<span class="formula-eq">=</span>
				<span class="formula-part">Speed <span class="formula-unit"><input
					id="base-speed"
					type="number"
					min="0.1"
					step="0.1"
					value={app.baseSpeed}
					oninput={(e) => setSpeedParam('baseSpeed', e.target.value)}
				/>km/h</span></span>
				<span class="formula-op">·</span>
				<span class="formula-part">Ascent <span class="formula-unit"><input
					id="ascent-rate"
					type="number"
					min="1"
					step="10"
					value={app.ascentRate}
					oninput={(e) => setSpeedParam('ascentRate', e.target.value)}
				/>m/h</span></span>
				<span class="formula-op">·</span>
				<span class="formula-part">Descent <span class="formula-unit"><input
					id="descent-rate"
					type="number"
					min="1"
					step="10"
					value={app.descentRate}
					oninput={(e) => setSpeedParam('descentRate', e.target.value)}
				/>m/h</span></span>
				<span class="time-info">
					<button class="snap-info-btn" onclick={() => timeTooltipOpen = !timeTooltipOpen} aria-label="Walking time formula info">
						ⓘ
					</button>
					{#if timeTooltipOpen}
						<div class="snap-tooltip snap-tooltip--left">
							Swiss hiking time formula (SAC / DIN 33466):
							<br />horizontal time = distance ÷ speed
							<br />vertical time = ascent ÷ rate + descent ÷ rate
							<br />total = larger value + half the smaller
						</div>
					{/if}
				</span>
			</div>

			{#if noElevation}
				<div class="notice" role="status">
					<span class="notice-icon">!</span>
					No elevation data — hm ↑ / hm ↓ are 0, so Lkm and Time only reflect the horizontal distance. Try the other Elevation API.
				</div>
			{/if}

			<div class="table-wrap">
				<table class:table--no-ele={noElevation}>
					<thead>
						<tr>
							<th>Day</th>
							<th class="num">km</th>
							<th class="num">hm ↑</th>
							<th class="num">hm ↓</th>
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
							<th class="num">Time</th>
						</tr>
					</thead>
					<tbody>
						{#each stagesWithTime as stage, i}
							<tr style="--delay: {i * 30}ms">
								<td class="day">Day {stage.day}</td>
								<td class="num">{stage.distance.toFixed(1)}</td>
								<td class="num">{stage.ascent}</td>
								<td class="num">{stage.descent}</td>
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
								<td class="num time">{formatDuration(stage.walkingTime)}</td>
							</tr>
							{#if nightGroups.has(stage.day)}
								{@const group = nightGroups.get(stage.day)}
								{@const selected = selectedVariantOf(group.stageNum)}
								{@const defaultVariant = app.stageGroups.find((g) => g.stageNum === group.stageNum)?.variants[0].variant}
								{@const delta = selected !== defaultVariant ? nightDelta(group.stageNum) : null}
								<tr class="night-row" style="--delay: {i * 30}ms">
									<td colspan="7">
										<div class="night-row-inner">
											<span class="night-label">⛺ Night {group.stageNum}</span>
											<span class="night-chips">
												{#each group.variants as v (v.variant)}
													<button
														class="tent-chip"
														class:tent-chip--active={v.variant === selected}
														title={v.name}
														onclick={() => selectTentSpot(group.stageNum, v.variant)}
													>
														{group.stageNum}{v.variant}
													</button>
												{/each}
											</span>
											{#if delta}
												<span class="night-delta">
													{#each delta as part}
														<span>{part}</span>
													{/each}
												</span>
											{/if}
										</div>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
					<tfoot>
						<tr>
							<td class="day">Total</td>
							<td class="num">{totalDistance.toFixed(1)}</td>
							<td class="num">{totalAscent}</td>
							<td class="num">{totalDescent}</td>
							<td class="num snap-cell"></td>
							<td class="num lkm">{totalPerformanceKm.toFixed(1)}</td>
							<td class="num time">{formatDuration(totalWalkingTime)}</td>
						</tr>
					</tfoot>
				</table>
			</div>

			<div class="results-actions">
				<button class="export-btn" onclick={exportCSV}>
					Export CSV
				</button>
			</div>

			{#if app.stages.length > 1}
				<StageChart stages={stagesWithTime} />
			{/if}

			{#if app.currentTrack}
				{#if showMap && RouteMap}
					<div class="map-section">
						<RouteMap
							track={app.currentTrack}
							waypoints={app.currentWaypoints ?? []}
							onClose={() => showMap = false}
						/>
					</div>
				{:else}
					<div class="map-placeholder">
						<svg class="map-placeholder-bg" aria-hidden="true" viewBox="0 0 800 160" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
							<!-- two subtle curved roads -->
							<path d="M0,110 Q300,60 500,85 Q650,105 800,65" fill="none" stroke="rgba(210,201,160,0.09)" stroke-width="12" stroke-linecap="round"/>
							<path d="M0,50  Q200,90 420,55 Q600,25 800,50" fill="none" stroke="rgba(210,201,160,0.07)" stroke-width="7"  stroke-linecap="round"/>
							<!-- a few building blocks -->
							<rect x="60"  y="18"  width="36" height="18" rx="3" fill="rgba(210,201,160,0.05)"/>
							<rect x="620" y="115" width="40" height="20" rx="3" fill="rgba(210,201,160,0.05)"/>
							<rect x="720" y="20"  width="28" height="14" rx="3" fill="rgba(210,201,160,0.05)"/>
							<!-- start pin -->
							<g transform="translate(180,72)">
								<ellipse cx="0" cy="-2" rx="9" ry="9" fill="rgba(212,113,154,0.7)"/>
								<polygon points="-4,5 4,5 0,15" fill="rgba(212,113,154,0.7)"/>
								<circle cx="0" cy="-2" r="3.5" fill="rgba(2,45,24,0.75)"/>
							</g>
							<!-- end pin -->
							<g transform="translate(640,58)">
								<ellipse cx="0" cy="-2" rx="9" ry="9" fill="rgba(212,113,154,0.7)"/>
								<polygon points="-4,5 4,5 0,15" fill="rgba(212,113,154,0.7)"/>
								<circle cx="0" cy="-2" r="3.5" fill="rgba(2,45,24,0.75)"/>
							</g>
						</svg>
						<button class="map-reveal-btn" onclick={revealMap}>
							{showMap ? 'Loading Map…' : 'Show Route Map'}
						</button>
					</div>
				{/if}
			{/if}
		</div>
	{/if}

	<footer>
		<img src="/favicon.svg" alt="" class="footer-logo" />
		<span>Built by <a href="https://seimon.ch" target="_blank" rel="noopener">Simon Müller</a></span>
	</footer>
</main>

<style>
	main {
		max-width: 820px;
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
		color: rgba(210, 201, 160, 0.4);
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
		color: rgba(210, 201, 160, 0.6);
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

	/* ── Notice (non-fatal warning) ── */

	.notice {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		background: rgba(250, 173, 23, 0.07);
		color: #FAAD17;
		border-radius: 12px;
		padding: 0.85rem 1rem;
		margin-bottom: 1.25rem;
		font-size: 0.95rem;
		line-height: 1.45;
	}

	.notice-icon {
		flex-shrink: 0;
		width: 1.3rem;
		height: 1.3rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: rgba(250, 173, 23, 0.15);
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

	.track-points {
		font-size: 0.8rem;
		color: rgba(210, 201, 160, 0.4);
		font-weight: 400;
	}

	h2 {
		font-size: 1.35rem;
		font-weight: 700;
		color: #D2C9A0;
		margin: 0;
		letter-spacing: -0.01em;
	}

	.formula-bar {
		position: relative;
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

	.formula-label--time {
		color: #D4719A;
	}

	.formula-eq {
		color: rgba(210, 201, 160, 0.4);
	}

	.time-info {
		margin-left: 0.15rem;
	}

	.formula-part {
		color: rgba(210, 201, 160, 0.65);
	}

	.formula-op {
		color: rgba(210, 201, 160, 0.4);
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

	/* ── Tent spot night rows ── */

	.night-row td {
		padding: 0.3rem 0.85rem;
		background: rgba(126, 183, 127, 0.05);
		border-top: 1px dashed rgba(126, 183, 127, 0.22);
		border-bottom: 1px dashed rgba(126, 183, 127, 0.22);
	}

	tbody tr.night-row:hover {
		background: transparent;
	}

	.night-row-inner {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.3rem 0.6rem;
	}

	.night-label {
		font-size: 0.8rem;
		color: rgba(210, 201, 160, 0.5);
		white-space: nowrap;
	}

	.night-chips {
		display: inline-flex;
		gap: 0.25rem;
	}

	.night-delta {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.2rem 0.9rem;
		margin-left: auto;
		font-size: 0.8rem;
		color: rgba(126, 183, 127, 0.85);
		font-variant-numeric: tabular-nums;
	}

	.tent-chip {
		padding: 0.18rem 0.55rem;
		font-size: 0.82rem;
		font-weight: 600;
		font-family: 'Karla', system-ui, sans-serif;
		font-variant-numeric: tabular-nums;
		color: rgba(210, 201, 160, 0.6);
		background: transparent;
		border: 1.5px solid rgba(210, 201, 160, 0.12);
		border-radius: 7px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.tent-chip:hover {
		color: rgba(210, 201, 160, 0.8);
		border-color: rgba(210, 201, 160, 0.25);
	}

	.tent-chip--active {
		color: #7EB77F;
		border-color: rgba(126, 183, 127, 0.45);
		background: rgba(126, 183, 127, 0.08);
	}

	/* ── Table ── */

	.table-wrap {
		border-radius: 12px;
		overflow-x: auto;
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
		white-space: nowrap;
	}

	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.lkm {
		color: #FAAD17;
		font-weight: 600;
	}

	.time {
		color: #D4719A;
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

	tfoot .time {
		color: #D4719A;
	}

	/* Without elevation data the hm ↑/↓ (cols 3–4), Lkm (6) and Time (7)
	   values are misleading — fade them out. */
	.table--no-ele th:nth-child(3),
	.table--no-ele td:nth-child(3),
	.table--no-ele th:nth-child(4),
	.table--no-ele td:nth-child(4),
	.table--no-ele th:nth-child(6),
	.table--no-ele td:nth-child(6),
	.table--no-ele th:nth-child(7),
	.table--no-ele td:nth-child(7) {
		opacity: 0.35;
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

	/* Must come after .snap-tooltip so left/right both win the cascade —
	   otherwise the box gets pinned to both edges of its container.
	   Anchored to the formula bar (its nearest positioned ancestor),
	   so it never hangs off-screen on narrow viewports. */
	.snap-tooltip--left {
		right: auto;
		left: 0;
		white-space: normal;
		max-width: 100%;
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
	.snap-red { background: #ef5a5a; }

	.snap-val {
		font-size: 0.75rem;
		color: rgba(210, 201, 160, 0.6);
		vertical-align: middle;
	}

	.snap-na {
		color: rgba(210, 201, 160, 0.2);
	}

	/* ── Results actions ── */

	.results-actions {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 1rem;
	}

	.export-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
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

	/* ── Map section ── */

	.map-section {
		margin-top: 2rem;
	}

	.map-placeholder {
		position: relative;
		margin-top: 2rem;
		height: 160px;
		border-radius: 14px;
		overflow: hidden;
		border: 1px solid rgba(210, 201, 160, 0.08);
		background: rgba(210, 201, 160, 0.02);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.map-placeholder-bg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.map-reveal-btn {
		position: relative;
		z-index: 1;
		padding: 0.65rem 1.6rem;
		background: rgba(212, 113, 154, 0.12);
		color: #D4719A;
		border: 1.5px solid rgba(212, 113, 154, 0.35);
		border-radius: 10px;
		font-size: 0.95rem;
		font-weight: 700;
		font-family: 'Karla', system-ui, sans-serif;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s;
		letter-spacing: 0.01em;
	}

	.map-reveal-btn:hover {
		background: rgba(212, 113, 154, 0.22);
		border-color: #D4719A;
	}

	/* ── Footer ── */

	footer {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		margin-top: 3rem;
		padding: 1.5rem 0;
		border-top: 1px solid rgba(210, 201, 160, 0.06);
		font-size: 0.75rem;
		color: rgba(210, 201, 160, 0.4);
	}

	.footer-logo {
		width: 22px;
		height: 22px;
	}

	footer a {
		color: rgba(210, 201, 160, 0.6);
		text-decoration: none;
		transition: color 0.15s;
	}

	footer a:hover {
		color: #D4719A;
	}
</style>

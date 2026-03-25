<script>
</script>

<main>
	<nav>
		<a href="/">← Back to Planner</a>
	</nav>

	<header>
		<h1>How It Works</h1>
		<p class="subtitle">Route planning guide and calculation reference</p>
	</header>

	<section>
		<h2>1. Plan Your Route in Google Earth Pro</h2>
		<p>
			Each team creates a single <strong>KML file</strong> in Google Earth Pro that covers all aspects of the route planning. Draw your main route as a single continuous path.
		</p>
		<div class="tip">
			Use "Add Path" in Google Earth Pro to trace your route along trails and paths. Draw your main route in one piece! The more closely it follows the terrain, the more accurate the distance and elevation calculations will be.
		</div>

		<h3>Route Types</h3>
		<p>
			<code>TXX</code> stands for your team and team number (e.g. <code>T01</code> for Team 01). Each team should have a main route along with alternatives and optional side trips:
		</p>
		<div class="examples">
			<div class="example-row">
				<code>TXX_Route</code>
				<span>Main route — draw in one continuous path</span>
			</div>
			<div class="example-row">
				<code>AXX.3</code>
				<span>Alternative 3 for your team</span>
			</div>
			<div class="example-row">
				<code>SXX.5</code>
				<span>Side trip 5 for your team</span>
			</div>
		</div>
		<div class="tip">
			If you stay at the same location for two nights, add a side trip for that day.
		</div>

		<h3>Folder Structure</h3>
		<p>Organize your KML file using the following structure:</p>
		<div class="folder-tree">
			<div class="folder">TXX</div>
			<div class="folder indent-1">TXX_Route</div>
			<div class="file indent-2">TXX_Route</div>
			<div class="file indent-2">TXX_Alternative_X</div>
			<div class="file indent-2">TXX_Sidetrips_X</div>
			<div class="folder indent-1">TXX_Wegpunkte</div>
			<div class="file indent-2">Tagesziele</div>
			<div class="file indent-2">Gefahrenstellen</div>
			<div class="file indent-2">Evakuierungsstellen</div>
			<div class="file indent-2">Highlights</div>
			<div class="file indent-2">Flussquerungen</div>
			<div class="file indent-2">Passes</div>
		</div>
	</section>

	<section>
		<h2>2. Mark Your Daily Stages with Waypoints</h2>
		<p>
			Add <strong>placemarks (waypoints)</strong> to mark your daily stage endpoints — the places where your team will stop for the night. Day 1 of the trek is stage 1.
		</p>

		<h3>Stage Waypoint Format</h3>
		<p>Name your stage waypoints using this pattern:</p>
		<div class="code-block">
			<code>TXX.Y</code>
		</div>
		<p>Where:</p>
		<ul>
			<li><strong>T</strong> — prefix for "Team"</li>
			<li><strong>XX</strong> — your team number (e.g. <code>01</code>, <code>10</code>)</li>
			<li><strong>Y</strong> — the day/stage number (e.g. <code>1</code>, <code>2</code>, <code>3</code>)</li>
		</ul>

		<h3>Stage Examples</h3>
		<div class="examples">
			<div class="example-row">
				<code>T01.1</code>
				<span>Team 01, end of day 1</span>
			</div>
			<div class="example-row">
				<code>T01.2</code>
				<span>Team 01, end of day 2</span>
			</div>
			<div class="example-row">
				<code>T01.5</code>
				<span>Team 01, end of day 5 — e.g. "Clearing by lone tree"</span>
			</div>
		</div>

		<h3>Multiple Options per Stage</h3>
		<p>
			If you have multiple overnight options for a stage, append a letter. The tool will automatically pick the preferred variant:
		</p>
		<div class="examples">
			<div class="example-row">
				<code>T01.3</code>
				<span>Preferred (no suffix = highest priority)</span>
			</div>
			<div class="example-row">
				<code>T01.3a</code>
				<span>Option A (used if no unsuffixed version exists)</span>
			</div>
			<div class="example-row">
				<code>T01.3b</code>
				<span>Option B (lower priority)</span>
			</div>
		</div>

		<div class="tip">
			You can also give waypoints a descriptive name to make planning discussions easier — e.g. <code>T01.5</code> "Clearing by lone tree" instead of just "campsite".
		</div>
	</section>

	<section>
		<h2>3. All Waypoint Types</h2>
		<p>
			Besides stage waypoints (T), there are several other waypoint types. Only <strong>T-waypoints</strong> are used by this tool to split the route into daily stages — all others are ignored during calculation.
		</p>
		<div class="examples">
			<div class="example-row">
				<code>T01.5</code>
				<span><strong>Stage endpoint</strong> — daily goal / overnight</span>
			</div>
			<div class="example-row">
				<code>D01</code>
				<span><strong>Drop-off</strong> — start of the trek</span>
			</div>
			<div class="example-row">
				<code>Pi01</code>
				<span><strong>Pick-up</strong> — end of the trek</span>
			</div>
			<div class="example-row">
				<code>GE01.2</code>
				<span><strong>Danger zone</strong> — e.g. "steep scree field"</span>
			</div>
			<div class="example-row">
				<code>P01.1</code>
				<span><strong>Pass</strong> — include elevation, e.g. "3031 m"</span>
			</div>
			<div class="example-row">
				<code>F01.5</code>
				<span><strong>River crossing</strong> — indexed sequentially</span>
			</div>
			<div class="example-row">
				<code>H01.6</code>
				<span><strong>Highlight</strong> — e.g. "Santis"</span>
			</div>
			<div class="example-row">
				<code>E01.4</code>
				<span><strong>Evacuation point</strong> — include road name if available</span>
			</div>
		</div>
		<div class="tip">
			Danger zones (GE) and river crossings (F) are indexed sequentially across the whole trip, not per day.
		</div>
	</section>

	<section>
		<h2>4. Export and Upload</h2>
		<p>
			Save your route from Google Earth Pro as a <strong>KML</strong> or <strong>GPX</strong> file, then drag it into the planner or click to browse. Both formats work equally well.
		</p>
		<div class="tip">
			Waypoints are optional. If your file only contains a track (no waypoints), the entire route is analyzed as a single stage — you still get distance, ascent, descent, Lkm, and density.
		</div>
	</section>

	<section>
		<h2>5. Elevation Data</h2>
		<p>
			Google Earth Pro does not include usable elevation data when exporting paths. Coordinates are typically stored as "clamped to ground" with an altitude of 0.
		</p>
		<p>
			To calculate ascent and descent, the tool automatically fetches real elevation data from a third-party API. You can switch between two providers using the <strong>Elevation API</strong> toggle on the main page.
		</p>

		<h3>Open-Elevation (default)</h3>
		<ul>
			<li>Based on <strong>SRTM</strong> datasets with ~30 m resolution</li>
			<li>All coordinates are sent in a <strong>single POST request</strong></li>
			<li>Free and open-source, but may occasionally be down</li>
		</ul>

		<h3>Open-Meteo (fallback)</h3>
		<ul>
			<li>Based on <strong>Copernicus DEM</strong> with ~90 m resolution</li>
			<li>Coordinates are sent in <strong>batched GET requests</strong> (50 points per batch, 1.5 s delay)</li>
			<li>Free, no API key required</li>
		</ul>

		<p>
			Both providers automatically <strong>retry up to 3 times</strong> if a request fails (e.g. rate limit or server error). If one API isn't working, switch to the other and try again.
		</p>

		<div class="tip">
			The elevation lookup may take a few seconds depending on route length and API load. Open-Meteo is generally more reliable; Open-Elevation offers higher resolution but may have downtime.
		</div>
	</section>

	<section>
		<h2>6. How Stages Are Calculated</h2>
		<p>
			The tool finds each <strong>T-waypoint</strong> (stage endpoint), matches it to the <strong>nearest point on the track</strong>, and splits the route at those points. Your waypoints don't need to be placed exactly on the track — they can be up to a few hundred meters off and it will still work.
		</p>

		<h3>Snapping Algorithm</h3>
		<ol>
			<li>For each T-waypoint, the tool calculates the geodesic distance to <strong>every point on the track</strong> and picks the closest one.</li>
			<li>The waypoints are then <strong>sorted by their position along the track</strong> (by track point index).</li>
			<li>The track is <strong>split at those track points</strong>, creating one stage between each pair of consecutive split points.</li>
		</ol>

		<div class="tip">
			The waypoint's own position is never used for distance or elevation — it only determines <strong>where to split</strong> the track. All measurements follow the actual track line, so off-track waypoints don't affect accuracy.
		</div>

		<h3>Per-Stage Measurements</h3>
		<p>For each stage, the following values are calculated by walking along the track points:</p>
		<ul>
			<li><strong>Distance (km)</strong> — the geodesic (real-world) distance along the track, accounting for the curvature of the Earth</li>
			<li><strong>Ascent (hm ↑)</strong> — total meters of elevation gained (only uphill sections count)</li>
			<li><strong>Descent (hm ↓)</strong> — total meters of elevation lost (only downhill sections count)</li>
		</ul>

		<h3>Quality Indicators</h3>
		<p>The results table includes two quality columns to help you judge the reliability of each stage's data. Click the <strong>ⓘ</strong> icon in each column header for details.</p>
		<ul>
			<li><strong>Snap</strong> — how far the stage endpoint waypoint was from the nearest track point (in meters). A large snap distance means the waypoint was placed far from the route, so the stage boundary may be slightly off.</li>
			<li><strong>Density</strong> — the average spacing between consecutive track points in that stage. Denser tracks produce more accurate distance and elevation measurements; sparse tracks may cut corners.</li>
		</ul>
		<div class="tip">
			Both indicators use a traffic-light system: <strong>green</strong> = good, <strong>yellow</strong> = acceptable, <strong>red</strong> = review recommended.
		</div>
	</section>

	<section>
		<h2>7. Performance Distance (Lkm)</h2>
		<p>
			The Performance Distance (Leistungskilometer) combines horizontal distance with elevation change to give a more realistic sense of effort.
		</p>

		<div class="formula-card">
			<div class="formula-title">Formula</div>
			<div class="formula-equation">
				Lkm = Distance <span class="unit">(km)</span> + Ascent <span class="unit">(m)</span> ÷ <span class="highlight">100</span>
			</div>
			<div class="formula-desc">
				Every 100 meters of ascent adds 1 performance kilometer.
			</div>
		</div>

		<h3>Example</h3>
		<p>
			A stage of <strong>12 km</strong> with <strong>800 m</strong> ascent:
		</p>
		<div class="formula-card">
			<div class="formula-equation">
				12 + 800 ÷ 100 = <span class="highlight">20 Lkm</span>
			</div>
		</div>

		<h3>Optional: Include Descent</h3>
		<p>
			You can optionally include descent in the formula by clicking <strong>"+ Descent"</strong> in the planner. The default descent divisor is 150, meaning every 150 m of descent adds 1 Lkm. Both divisors are adjustable.
		</p>
		<div class="formula-card">
			<div class="formula-equation">
				Lkm = Distance + Ascent ÷ <span class="highlight">100</span> + Descent ÷ <span class="highlight">150</span>
			</div>
		</div>
	</section>

	<section>
		<h2>8. Export Results</h2>
		<p>
			Once calculated, you can export all stage data as a <strong>CSV file</strong> for use in spreadsheets or further planning. The export includes day number, distance, ascent, descent, and performance distance for each stage.
		</p>
	</section>
</main>

<style>
	main {
		max-width: 620px;
		margin: 0 auto;
		padding: 3rem 1.25rem 5rem;
	}

	/* ── Nav ── */

	nav {
		margin-bottom: 2rem;
	}

	nav a {
		color: rgba(210, 201, 160, 0.65);
		text-decoration: none;
		font-size: 1rem;
		font-weight: 500;
		transition: color 0.15s;
	}

	nav a:hover {
		color: #D4719A;
	}

	/* ── Header ── */

	header {
		margin-bottom: 2.5rem;
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
	}

	/* ── Sections ── */

	section {
		margin-bottom: 2.5rem;
	}

	h2 {
		font-size: 1.35rem;
		font-weight: 700;
		color: #D2C9A0;
		margin: 0 0 0.65rem;
		letter-spacing: -0.01em;
	}

	h3 {
		font-size: 1.1rem;
		font-weight: 600;
		color: rgba(210, 201, 160, 0.7);
		margin: 1.25rem 0 0.45rem;
	}

	p {
		font-size: 1.05rem;
		line-height: 1.6;
		color: rgba(210, 201, 160, 0.65);
		margin: 0 0 0.6rem;
	}

	ul {
		margin: 0.3rem 0 0.6rem;
		padding-left: 1.2rem;
	}

	li {
		font-size: 1.05rem;
		line-height: 1.6;
		color: rgba(210, 201, 160, 0.65);
		margin-bottom: 0.25rem;
	}

	li strong {
		color: rgba(210, 201, 160, 0.85);
	}

	p strong {
		color: rgba(210, 201, 160, 0.85);
		font-weight: 600;
	}

	code {
		font-family: 'Karla', system-ui, monospace;
		font-weight: 700;
		color: #FAAD17;
		font-size: 1.05rem;
	}

	/* ── Tip box ── */

	.tip {
		background: rgba(210, 201, 160, 0.04);
		border-left: 2.5px solid rgba(210, 201, 160, 0.15);
		padding: 0.65rem 0.85rem;
		border-radius: 0 8px 8px 0;
		font-size: 1rem;
		line-height: 1.55;
		color: rgba(210, 201, 160, 0.6);
		margin: 0.75rem 0;
	}

	/* ── Code block ── */

	.code-block {
		background: rgba(210, 201, 160, 0.05);
		border: 1px solid rgba(210, 201, 160, 0.08);
		border-radius: 8px;
		padding: 0.6rem 0.85rem;
		margin: 0.5rem 0 0.65rem;
	}

	/* ── Folder tree ── */

	.folder-tree {
		background: rgba(210, 201, 160, 0.03);
		border: 1px solid rgba(210, 201, 160, 0.06);
		border-radius: 8px;
		padding: 0.6rem 0.85rem;
		margin: 0.5rem 0 0.65rem;
		font-size: 1.02rem;
		font-family: 'Karla', system-ui, monospace;
		line-height: 1.7;
	}

	.folder-tree .folder {
		color: #FAAD17;
		font-weight: 600;
	}

	.folder-tree .file {
		color: rgba(210, 201, 160, 0.5);
		font-weight: 400;
	}

	.folder-tree .indent-1 {
		padding-left: 1.2rem;
	}

	.folder-tree .indent-2 {
		padding-left: 2.4rem;
	}

	/* ── Examples ── */

	.examples {
		display: flex;
		flex-direction: column;
		gap: 0;
		background: rgba(210, 201, 160, 0.03);
		border-radius: 8px;
		border: 1px solid rgba(210, 201, 160, 0.06);
		overflow: hidden;
		margin: 0.5rem 0 0.65rem;
	}

	.example-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.45rem 0.85rem;
		font-size: 1.05rem;
	}

	.example-row:not(:last-child) {
		border-bottom: 1px solid rgba(210, 201, 160, 0.05);
	}

	.example-row code {
		flex-shrink: 0;
		min-width: 5rem;
	}

	.example-row span {
		color: rgba(210, 201, 160, 0.6);
	}

	/* ── Formula card ── */

	.formula-card {
		background: rgba(210, 201, 160, 0.04);
		border: 1px solid rgba(210, 201, 160, 0.08);
		border-radius: 10px;
		padding: 0.85rem 1rem;
		margin: 0.65rem 0;
	}

	.formula-title {
		font-size: 0.9rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: rgba(210, 201, 160, 0.35);
		margin-bottom: 0.35rem;
	}

	.formula-equation {
		font-size: 1.15rem;
		font-weight: 600;
		color: rgba(210, 201, 160, 0.75);
	}

	.formula-equation .unit {
		color: rgba(210, 201, 160, 0.35);
		font-weight: 400;
	}

	.formula-equation .highlight {
		color: #FAAD17;
		font-weight: 700;
	}

	.formula-desc {
		font-size: 1rem;
		color: rgba(210, 201, 160, 0.55);
		margin-top: 0.3rem;
	}
</style>

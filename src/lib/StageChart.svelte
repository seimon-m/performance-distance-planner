<script>
	import { onMount } from 'svelte';
	import { formatDuration } from './calc.js';

	let { stages } = $props();

	let canvas = $state(null);

	const PAD = { top: 36, right: 72, bottom: 52, left: 72 };

	const THEME_SCREEN = {
		bg:          '#022D18',
		barAscent:   'rgba(21, 89, 118, 0.75)',
		barDescent:  'rgba(21, 89, 118, 0.35)',
		line:        '#FAAD17',
		grid:        'rgba(210, 201, 160, 0.15)',
		label:       'rgba(210, 201, 160, 0.55)',
		labelLkm:    '#FAAD17',
	};

	const THEME_PRINT = {
		bg:          null,
		barAscent:   'rgba(30, 100, 160, 0.7)',
		barDescent:  'rgba(30, 100, 160, 0.3)',
		line:        '#c07000',
		grid:        'rgba(0, 0, 0, 0.12)',
		label:       'rgba(0, 0, 0, 0.55)',
		labelLkm:    '#c07000',
	};

	function niceMax(v) {
		if (v <= 0) return 1;
		const magnitude = Math.pow(10, Math.floor(Math.log10(v)));
		const step = magnitude / 2;
		return Math.ceil(v / step) * step;
	}

	function renderChart(ctx, W, H, theme) {
		const chartW = W - PAD.left - PAD.right;
		const chartH = H - PAD.top  - PAD.bottom;

		if (theme.bg) {
			ctx.fillStyle = theme.bg;
			ctx.fillRect(0, 0, W, H);
		} else {
			ctx.clearRect(0, 0, W, H);
		}

		const maxAscent  = Math.max(...stages.map(s => s.ascent), 1);
		const maxDescent = Math.max(...stages.map(s => s.descent), 1);
		const maxHm      = Math.max(maxAscent, maxDescent);
		const maxLkm     = Math.max(...stages.map(s => s.performanceKm), 1);

		const niceHm  = niceMax(maxHm);
		const niceLkm = niceMax(maxLkm);

		const n      = stages.length;
		const groupW = chartW / n;
		const barW   = (groupW - groupW * 0.15 * 2) / 2;

		function xOf(i) { return PAD.left + i * groupW + groupW / 2; }
		function yHm(v)  { return PAD.top + chartH * (1 - v / niceHm); }
		function yLkm(v) { return PAD.top + chartH * (1 - v / niceLkm); }

		const ticks = 5;
		ctx.font = '12px Karla, system-ui, sans-serif';
		for (let t = 0; t <= ticks; t++) {
			const frac = t / ticks;
			const y = PAD.top + chartH * (1 - frac);

			ctx.strokeStyle = theme.grid;
			ctx.lineWidth = 1;
			ctx.setLineDash([4, 4]);
			ctx.beginPath();
			ctx.moveTo(PAD.left, y);
			ctx.lineTo(PAD.left + chartW, y);
			ctx.stroke();
			ctx.setLineDash([]);

			ctx.fillStyle = theme.label;
			ctx.textAlign = 'right';
			ctx.fillText(Math.round(niceHm * frac), PAD.left - 10, y + 4);

			ctx.fillStyle = theme.labelLkm;
			ctx.textAlign = 'left';
			ctx.fillText((niceLkm * frac).toFixed(1), PAD.left + chartW + 10, y + 4);
		}

		ctx.font = '12px Karla, system-ui, sans-serif';
		for (let i = 0; i < n; i++) {
			const s  = stages[i];
			const cx = xOf(i);

			ctx.fillStyle = theme.barAscent;
			ctx.beginPath();
			ctx.roundRect(cx - barW - 1, yHm(s.ascent), barW, chartH * (s.ascent / niceHm), [3, 3, 0, 0]);
			ctx.fill();

			ctx.fillStyle = theme.barDescent;
			ctx.beginPath();
			ctx.roundRect(cx + 1, yHm(s.descent), barW, chartH * (s.descent / niceHm), [3, 3, 0, 0]);
			ctx.fill();

			ctx.fillStyle = theme.label;
			ctx.textAlign = 'center';
			ctx.fillText(`D${s.day}`, cx, PAD.top + chartH + 20);

			if (s.walkingTime != null) {
				ctx.font = '11px Karla, system-ui, sans-serif';
				ctx.fillText(`${formatDuration(s.walkingTime)} h`, cx, PAD.top + chartH + 36);
				ctx.font = '12px Karla, system-ui, sans-serif';
			}
		}

		ctx.strokeStyle = theme.line;
		ctx.lineWidth   = 2.5;
		ctx.lineJoin    = 'round';
		ctx.beginPath();
		for (let i = 0; i < n; i++) {
			const x = xOf(i);
			const y = yLkm(stages[i].performanceKm);
			i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
		}
		ctx.stroke();

		ctx.fillStyle = theme.line;
		for (let i = 0; i < n; i++) {
			ctx.beginPath();
			ctx.arc(xOf(i), yLkm(stages[i].performanceKm), 4, 0, Math.PI * 2);
			ctx.fill();
		}

		ctx.save();
		ctx.font = 'bold 13px Karla, system-ui, sans-serif';
		ctx.fillStyle = theme.label;
		ctx.textAlign = 'center';
		ctx.translate(PAD.left - 54, PAD.top + chartH / 2);
		ctx.rotate(-Math.PI / 2);
		ctx.fillText('hm ↑ / ↓', 0, 0);
		ctx.restore();

		ctx.save();
		ctx.font = 'bold 13px Karla, system-ui, sans-serif';
		ctx.fillStyle = theme.labelLkm;
		ctx.textAlign = 'center';
		ctx.translate(PAD.left + chartW + PAD.right + 54, PAD.top + chartH / 2);
		ctx.rotate(Math.PI / 2);
		ctx.fillText('Lkm', 0, 0);
		ctx.restore();
	}

	function draw() {
		if (!canvas || !stages?.length) return;
		const dpr = window.devicePixelRatio || 1;
		const W = canvas.clientWidth;
		const H = canvas.clientHeight;
		canvas.width  = W * dpr;
		canvas.height = H * dpr;
		const ctx = canvas.getContext('2d');
		ctx.scale(dpr, dpr);
		renderChart(ctx, W, H, THEME_SCREEN);
	}

	function downloadChart() {
		if (!canvas || !stages?.length) return;
		const SCALE = 4;
		const W = canvas.clientWidth  * SCALE;
		const H = canvas.clientHeight * SCALE;
		const offscreen = document.createElement('canvas');
		offscreen.width  = W;
		offscreen.height = H;
		const ctx = offscreen.getContext('2d');
		ctx.scale(SCALE, SCALE);
		renderChart(ctx, canvas.clientWidth, canvas.clientHeight, THEME_PRINT);
		const link = document.createElement('a');
		link.download = 'stages-chart.png';
		link.href = offscreen.toDataURL('image/png');
		link.click();
	}

	$effect(() => {
		for (const s of stages ?? []) {
			s.ascent;
			s.descent;
			s.performanceKm;
			s.walkingTime;
		}
		if (canvas) draw();
	});

	onMount(() => {
		const ro = new ResizeObserver(() => draw());
		ro.observe(canvas);
		return () => ro.disconnect();
	});
</script>

<div class="chart-wrap">
	<div class="chart-header">
		<h3 class="chart-title">Daily Overview</h3>
		<div class="chart-legend">
			<span class="legend-item"><span class="legend-bar legend-ascent"></span> hm ↑</span>
			<span class="legend-item"><span class="legend-bar legend-descent"></span> hm ↓</span>
			<span class="legend-item"><span class="legend-line"></span> Lkm</span>
		</div>
	</div>
	<canvas bind:this={canvas}></canvas>
	<button class="dl-btn" onclick={downloadChart}>Download Chart</button>
</div>

<style>
	.chart-wrap {
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid rgba(210, 201, 160, 0.08);
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.chart-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.chart-title {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 700;
		color: #D2C9A0;
		letter-spacing: -0.01em;
	}

	canvas {
		width: 100%;
		height: 340px;
		border-radius: 12px;
		display: block;
	}

	.chart-legend {
		display: flex;
		gap: 1.2rem;
		font-size: 0.82rem;
		color: rgba(210, 201, 160, 0.55);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.legend-bar {
		display: inline-block;
		width: 12px;
		height: 10px;
		border-radius: 2px;
	}

	.legend-ascent  { background: rgba(21, 89, 118, 0.85); }
	.legend-descent { background: rgba(21, 89, 118, 0.4); }

	.legend-line {
		display: inline-block;
		width: 16px;
		height: 2.5px;
		background: #FAAD17;
		border-radius: 2px;
		position: relative;
	}

	.legend-line::after {
		content: '';
		position: absolute;
		width: 6px;
		height: 6px;
		background: #FAAD17;
		border-radius: 50%;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}

	.dl-btn {
		align-self: flex-start;
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

	.dl-btn:hover {
		background: rgba(212, 113, 154, 0.08);
		border-color: #D4719A;
	}

	.dl-btn:active {
		transform: scale(0.97);
	}
</style>

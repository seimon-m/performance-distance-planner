<script>
	import '@fontsource/karla/400.css';
	import '@fontsource/karla/500.css';
	import '@fontsource/karla/600.css';
	import '@fontsource/karla/700.css';
	import '@fontsource/karla/800.css';
	import favicon from '$lib/assets/favicon.svg';
	import { dev } from '$app/environment';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';

	let { children } = $props();

	injectAnalytics({ mode: dev ? 'development' : 'production' });

	const title = 'Performance Distance Planner';
	const description =
		'Upload a GPX or KML route from Google Earth and get daily stages with distance, ascent, descent and performance kilometers (Leistungskilometer) — including CSV export, stage chart and 3D route map.';
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://performance-distance-planner.vercel.app/" />
	<meta name="twitter:card" content="summary" />
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

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
</style>

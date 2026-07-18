<script>
	import '@fontsource/karla/400.css';
	import '@fontsource/karla/500.css';
	import '@fontsource/karla/600.css';
	import '@fontsource/karla/700.css';
	import '@fontsource/karla/800.css';
	import { dev } from '$app/environment';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';

	let { children } = $props();

	injectAnalytics({ mode: dev ? 'development' : 'production' });

	// Title, meta description, OG tags and favicon live in app.html —
	// SSR is disabled, so svelte:head content never reaches crawlers.
</script>

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

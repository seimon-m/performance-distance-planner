<script>
	import favicon from '$lib/assets/favicon.svg';
	import { dev } from '$app/environment';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';

	let { children } = $props();

	injectAnalytics({ mode: dev ? 'development' : 'production' });
</script>





<svelte:head>
	<title>Performance Distance Planner</title>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

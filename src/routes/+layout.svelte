<script>
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<title>Performance Distance Planner</title>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

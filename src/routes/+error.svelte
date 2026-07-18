<script>
	import { page } from '$app/state';
</script>

<main>
	<h1>{page.status}</h1>
	<p class="message">
		{page.status === 404 ? 'This page doesn’t exist.' : page.error?.message || 'Something went wrong.'}
	</p>
	<a href="/">← Back to Planner</a>
</main>

<style>
	main {
		max-width: 820px;
		margin: 0 auto;
		padding: 6rem 1.25rem;
		text-align: center;
	}

	h1 {
		font-size: 4rem;
		font-weight: 800;
		color: #D4719A;
		margin: 0 0 0.5rem;
		letter-spacing: -0.02em;
	}

	.message {
		color: rgba(210, 201, 160, 0.7);
		font-size: 1.1rem;
		margin: 0 0 2rem;
	}

	a {
		display: inline-flex;
		padding: 0.55rem 1.1rem;
		color: #D4719A;
		border: 1.5px solid rgba(212, 113, 154, 0.3);
		border-radius: 9px;
		font-size: 0.9rem;
		font-weight: 600;
		text-decoration: none;
		transition: all 0.15s ease;
	}

	a:hover {
		background: rgba(212, 113, 154, 0.08);
		border-color: #D4719A;
	}
</style>

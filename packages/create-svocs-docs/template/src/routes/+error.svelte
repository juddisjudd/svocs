<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>{page.status} | __SITE_NAME__</title>
</svelte:head>

<section class="error-page">
	<p class="code">{page.status}</p>
	<h1>{page.status === 404 ? 'Page not found' : 'Something went wrong'}</h1>
	<p class="message">
		{page.error?.message ?? "The page you're looking for doesn't exist or was moved."}
	</p>
	<div class="actions">
		<a class="btn primary" href={resolve('/')}>Go home</a>
		<a class="btn ghost" href={resolve('/docs')}>Read the docs</a>
	</div>
</section>

<style>
	.error-page {
		max-width: 32rem;
		margin: 0 auto;
		padding: 6rem 1.25rem 5rem;
		text-align: center;
	}

	.code {
		margin: 0 0 0.5rem;
		font-size: 0.9rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--accent-strong);
	}

	h1 {
		margin: 0 0 0.75rem;
		font-size: clamp(1.75rem, 4vw, 2.25rem);
		letter-spacing: -0.02em;
	}

	.message {
		margin: 0 auto 2rem;
		color: var(--text-soft);
		font-size: 1rem;
		line-height: 1.6;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.75rem;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 2.75rem;
		padding: 0.65rem 1.35rem;
		border-radius: 0.6rem;
		font-weight: 650;
		font-size: 0.95rem;
		text-decoration: none;
		transition: color 140ms ease;
	}

	.btn.primary {
		background: linear-gradient(180deg, var(--accent-strong), var(--accent));
		color: var(--accent-contrast);
		box-shadow:
			0 1px 2px rgba(0, 0, 0, 0.25),
			0 4px 14px color-mix(in srgb, var(--accent) 30%, transparent),
			inset 0 1px 0 rgba(255, 255, 255, 0.25);
	}

	.btn.ghost {
		color: var(--text);
		border: 1px solid var(--line-strong);
		background: color-mix(in srgb, var(--bg-soft) 72%, transparent);
	}

	@media (hover: hover) and (pointer: fine) {
		.btn.ghost:hover {
			color: var(--accent-soft);
		}
	}
</style>

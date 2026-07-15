<script lang="ts">
	import { resolve } from '$app/paths';
	import { SITE_NAME, SITE_DESCRIPTION } from '$lib/site';
</script>

<svelte:head>
	<title>{SITE_NAME}</title>
	<meta name="description" content={SITE_DESCRIPTION} />
</svelte:head>

<section class="hero">
	<h1>{SITE_NAME}</h1>
	<p>{SITE_DESCRIPTION}</p>
	<a class="btn" href={resolve('/docs')}>
		Read the docs
		<span aria-hidden="true">→</span>
	</a>
</section>

<style>
	.hero {
		max-width: 40rem;
		margin: 0 auto;
		padding: 6rem 1.25rem 5rem;
		text-align: center;
	}

	h1 {
		margin: 0 0 0.75rem;
		font-size: clamp(2.25rem, 5vw, 3.25rem);
		letter-spacing: -0.02em;
	}

	p {
		margin: 0 auto 2rem;
		max-width: 30rem;
		color: var(--text-soft);
		font-size: 1.05rem;
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
		background: linear-gradient(180deg, #ff6136, var(--accent));
		color: var(--accent-contrast);
		box-shadow:
			0 1px 2px rgba(0, 0, 0, 0.25),
			0 4px 14px rgba(255, 60, 0, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.25);
		transition: transform 140ms ease;
	}

	.btn span {
		transition: transform 140ms ease;
	}

	.btn:active {
		transform: scale(0.97);
	}

	@media (hover: hover) and (pointer: fine) {
		.btn:hover span {
			transform: translateX(3px);
		}
	}
</style>

<script lang="ts">
	const sponsorUrl = 'https://github.com/sponsors/your-org';
</script>

<svelte:head>
	<title>Sponsors | SVOCS</title>
	<meta name="description" content="Support SVOCS development through sponsorship." />
</svelte:head>

<main class="sponsors-page">
	<header class="page-head">
		<h1>Sponsors</h1>
		<p>
			SVOCS is free and open-source. Sponsorships fund ongoing development, documentation and
			maintenance — every slot below is open.
		</p>
		<a class="btn" href={sponsorUrl} target="_blank" rel="noreferrer">
			Become a sponsor
			<span aria-hidden="true">→</span>
		</a>
	</header>

	<ul class="sponsor-grid" aria-hidden="true">
		{#each Array(8) as _, i (i)}
			<li class="sponsor-slot"></li>
		{/each}
	</ul>
</main>

<style>
	.sponsors-page {
		max-width: 44rem;
		margin: 0 auto;
		padding: 3.5rem 1.25rem 5rem;
		text-align: center;
	}

	.page-head h1 {
		margin: 0 0 0.6rem;
		font-size: clamp(2rem, 4.5vw, 2.75rem);
		letter-spacing: -0.02em;
	}

	.page-head p {
		margin: 0 auto 1.75rem;
		max-width: 34rem;
		color: var(--text-soft);
		font-size: 1.02rem;
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

	.sponsor-grid {
		list-style: none;
		margin: 3rem auto 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(4.5rem, 1fr));
		gap: 0.85rem;
		max-width: 32rem;
	}

	.sponsor-slot {
		aspect-ratio: 1;
		border-radius: 999px;
		border: 1px dashed var(--line-strong);
		background: color-mix(in srgb, var(--bg-elev) 70%, transparent);
	}

	@media (max-width: 480px) {
		.sponsor-grid {
			grid-template-columns: repeat(auto-fill, minmax(3.5rem, 1fr));
		}
	}
</style>

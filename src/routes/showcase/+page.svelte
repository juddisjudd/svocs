<script lang="ts">
	import { resolve } from '$app/paths';

	const repoUrl = 'https://github.com/your-org/svocs';

	// Real showcase entries land here as they come in — this site is the
	// first, honest one: dogfooding, not a placeholder testimonial.
	const showcaseSites = [
		{
			title: 'SVOCS Docs',
			description: 'This site — built with SVOCS itself, docs and all.',
			href: resolve('/'),
			external: false
		}
	];
</script>

<svelte:head>
	<title>Showcase | SVOCS</title>
	<meta name="description" content="Sites and projects built with SVOCS." />
</svelte:head>

<main class="showcase-page">
	<header class="page-head">
		<h1>Showcase</h1>
		<p>Real sites shipped with SVOCS. Building something? Add yours below.</p>
	</header>

	<ul class="showcase-grid">
		{#each showcaseSites as site (site.title)}
			<li>
				<a
					href={site.href}
					target={site.external ? '_blank' : undefined}
					rel={site.external ? 'noreferrer' : undefined}
				>
					<span class="preview" aria-hidden="true">
						<i class="dot"></i><i class="dot"></i><i class="dot"></i>
						<b style="width: 55%"></b>
						<b style="width: 85%"></b>
						<b style="width: 70%"></b>
					</span>
					<strong>{site.title}</strong>
					<span class="desc">{site.description}</span>
				</a>
			</li>
		{/each}
		<li>
			<a class="submit" href={repoUrl} target="_blank" rel="noreferrer">
				<span class="preview submit-preview" aria-hidden="true">+</span>
				<strong>Add your site</strong>
				<span class="desc">Shipped something with SVOCS? Open a PR to add it here.</span>
			</a>
		</li>
	</ul>
</main>

<style>
	.showcase-page {
		max-width: 60rem;
		margin: 0 auto;
		padding: 3.5rem 1.25rem 5rem;
	}

	.page-head {
		text-align: center;
		margin-bottom: 2.5rem;
	}

	.page-head h1 {
		margin: 0 0 0.6rem;
		font-size: clamp(2rem, 4.5vw, 2.75rem);
		letter-spacing: -0.02em;
	}

	.page-head p {
		margin: 0 auto;
		max-width: 32rem;
		color: var(--text-soft);
		font-size: 1.02rem;
	}

	.showcase-grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: 1rem;
	}

	.showcase-grid a {
		display: grid;
		gap: 0.7rem;
		height: 100%;
		padding: 1rem;
		border-radius: 1rem;
		border: 1px solid var(--line);
		background: var(--bg-elev);
		text-decoration: none;
		transition: transform 150ms ease;
	}

	.preview {
		display: flex;
		flex-wrap: wrap;
		align-content: flex-start;
		gap: 0.35rem;
		height: 6rem;
		padding: 0.7rem;
		border-radius: 0.6rem;
		border: 1px solid var(--line);
		background: var(--bg-soft);
	}

	.dot {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 999px;
		background: var(--line-strong);
	}

	.dot:first-child {
		background: color-mix(in srgb, var(--accent) 65%, var(--line-strong));
	}

	.preview b {
		display: block;
		flex-basis: 100%;
		height: 0.45rem;
		border-radius: 999px;
		background: var(--bg-soft-2);
	}

	.submit-preview {
		display: grid;
		place-items: center;
		font-size: 1.8rem;
		color: var(--text-dim);
		background: transparent;
		border-style: dashed;
	}

	.showcase-grid a.submit {
		border-style: dashed;
	}

	.showcase-grid strong {
		color: var(--text);
		font-size: 1rem;
		transition: color 150ms ease;
	}

	.desc {
		display: block;
		font-size: 0.85rem;
		line-height: 1.5;
		color: var(--text-dim);
	}

	@media (hover: hover) and (pointer: fine) {
		.showcase-grid a:hover {
			transform: translateY(-2px);
		}

		.showcase-grid a:hover strong {
			color: var(--accent-strong);
		}
	}
</style>

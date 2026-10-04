<script lang="ts">
	import { withBase } from '#lib/core/base-path.js';

	let { src, alt, width, height }: { src: string; alt: string; width?: number; height?: number } =
		$props();

	const url = $derived(withBase(src));

	let dialogEl: HTMLDialogElement | undefined = $state();

	function open() {
		dialogEl?.showModal();
	}

	function close() {
		dialogEl?.close();
	}
</script>

<button type="button" class="trigger" onclick={open} aria-label={`Zoom image: ${alt}`}>
	<img src={url} {alt} {width} {height} loading="lazy" />
</button>

<dialog bind:this={dialogEl} class="zoom-dialog" onclick={close} onclose={close}>
	<img src={url} {alt} />
</dialog>

<style>
	.trigger {
		display: block;
		width: 100%;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: 0.65rem;
		background: none;
		cursor: zoom-in;
		overflow: hidden;
	}

	.trigger img {
		display: block;
		width: 100%;
		height: auto;
	}

	.zoom-dialog {
		border: none;
		background: transparent;
		max-width: 92vw;
		max-height: 92vh;
		padding: 0;
	}

	.zoom-dialog::backdrop {
		background: rgba(4, 2, 1, 0.82);
		backdrop-filter: blur(2px);
	}

	.zoom-dialog img {
		display: block;
		max-width: 92vw;
		max-height: 92vh;
		border-radius: 0.5rem;
		cursor: zoom-out;
	}
</style>

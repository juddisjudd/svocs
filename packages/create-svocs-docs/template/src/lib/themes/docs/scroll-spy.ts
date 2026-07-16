/**
 * TOC scroll-spy. A scroll listener, not IntersectionObserver: a short final
 * section's heading may never cross the threshold line, which would leave IO
 * stuck on an earlier heading at the bottom of the page.
 */
export function observeHeadings(
	container: HTMLElement | null,
	ids: string[],
	onActiveChange: (id: string | null) => void
): () => void {
	if (!container || ids.length === 0) {
		onActiveChange(null);
		return () => {};
	}

	const headings = ids
		.map((id) => container.querySelector<HTMLElement>(`#${CSS.escape(id)}`))
		.filter((el): el is HTMLElement => el !== null);

	if (headings.length === 0) {
		onActiveChange(null);
		return () => {};
	}

	const THRESHOLD_PX = 96;
	let ticking = false;

	function recompute() {
		ticking = false;

		const atBottom =
			window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;

		if (atBottom) {
			onActiveChange(headings[headings.length - 1].id);
			return;
		}

		let activeId: string | null = null;
		for (const el of headings) {
			if (el.getBoundingClientRect().top <= THRESHOLD_PX) {
				activeId = el.id;
			} else {
				break;
			}
		}
		onActiveChange(activeId ?? headings[0].id);
	}

	function scheduleRecompute() {
		if (ticking) return;
		ticking = true;
		requestAnimationFrame(recompute);
	}

	window.addEventListener('scroll', scheduleRecompute, { passive: true });
	window.addEventListener('resize', scheduleRecompute);
	recompute();

	return () => {
		window.removeEventListener('scroll', scheduleRecompute);
		window.removeEventListener('resize', scheduleRecompute);
	};
}

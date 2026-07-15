/**
 * Tracks which heading is "active" for a table-of-contents scroll-spy: the
 * last heading (in document order) whose top edge has scrolled above a
 * threshold line near the top of the viewport, falling back to the first
 * heading while still above all of them.
 *
 * Driven by a throttled scroll/resize listener rather than an
 * IntersectionObserver — IntersectionObserver only fires when a heading's
 * intersection ratio *crosses* a threshold, so if the page's final section
 * is short enough that its heading can never be scrolled up to the
 * threshold line (there isn't enough trailing content below it to push it
 * there), no more crossing events ever fire once you reach the bottom and
 * the active state gets stuck on an earlier heading. A scroll listener with
 * an explicit "am I at the bottom of the page" check sidesteps that.
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

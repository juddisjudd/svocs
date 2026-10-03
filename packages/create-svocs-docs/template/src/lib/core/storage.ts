import { browser } from '$app/env';

/** Reads localStorage without touching it during SSR or throwing when the browser blocks storage. */
export function readStorage(key: string): string | null {
	if (!browser) {
		return null;
	}
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

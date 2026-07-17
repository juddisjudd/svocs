declare module '*.md' {
	import type { Component } from 'svelte';

	export const metadata: {
		title?: string;
		description?: string;
		order?: number;
		tags?: string[];
		icon?: string;
		items?: Record<string, { title?: string; order?: number }>;
	};

	const component: Component;
	export default component;
}

declare module '*.svx' {
	import type { Component } from 'svelte';

	export const metadata: {
		title?: string;
		description?: string;
		order?: number;
		tags?: string[];
		icon?: string;
	};

	const component: Component;
	export default component;
}

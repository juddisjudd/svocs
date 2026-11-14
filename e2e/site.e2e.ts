import { expect, test, type Page } from '@playwright/test';

function collectErrors(page: Page): string[] {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text());
	});
	return errors;
}

// A button clicked before Svelte hydrates does nothing, so wait for the page's scripts to finish loading.
async function gotoHydrated(page: Page, path: string) {
	await page.goto(path, { waitUntil: 'networkidle' });
}

test.beforeEach(async ({ page }) => {
	// Analytics is loaded from app.html; keep tests offline and quiet.
	await page.route('https://umami.bawkbawk.net/**', (route) =>
		route.fulfill({ contentType: 'text/javascript', body: '' })
	);
});

test('home page links into the docs', async ({ page }) => {
	const errors = collectErrors(page);
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Make beautiful docs');

	await page.getByRole('link', { name: 'Read the docs' }).first().click();
	await expect(page).toHaveURL(/\/docs$/);
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	expect(errors).toEqual([]);
});

test('sidebar navigates between doc pages', async ({ page }) => {
	const errors = collectErrors(page);
	await page.goto('/docs');
	const sidebar = page.getByRole('navigation', { name: 'Documentation navigation' });

	await sidebar.getByRole('link', { name: 'Writing Content' }).click();
	await expect(page).toHaveURL(/\/docs\/writing-content$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Writing Content');
	expect(errors).toEqual([]);
});

test('renders KaTeX math and Mermaid diagrams', async ({ page }) => {
	const errors = collectErrors(page);
	await page.goto('/docs/architecture');
	await expect(page.locator('.katex').first()).toBeVisible();
	await expect(page.locator('pre.mermaid svg').first()).toBeVisible();
	expect(errors).toEqual([]);
});

test('search finds pages from the built index', async ({ page }) => {
	await gotoHydrated(page, '/docs');
	await page.getByRole('button', { name: 'Search documentation' }).click();
	await page.getByRole('combobox').fill('mermaid');

	const firstResult = page.getByRole('option').first();
	await expect(firstResult).toBeVisible();
	await firstResult.getByRole('button').click();
	await expect(page).toHaveURL(/\/docs\//);
});

test('search lists matching sections and opens them at their heading', async ({ page }) => {
	await gotoHydrated(page, '/docs');
	await page.getByRole('button', { name: 'Search documentation' }).click();
	await page.getByRole('combobox').fill('reusing content');

	const section = page.getByRole('option', { name: /Reusing content/ }).first();
	await expect(section).toBeVisible();
	await section.getByRole('button').click();
	await expect(page).toHaveURL(/\/docs\/writing-content#reusing-content$/);
});

test('a collapsed sidebar stays collapsed across a reload', async ({ page }) => {
	await gotoHydrated(page, '/docs');
	const links = page.locator('aside nav');
	await page.getByRole('button', { name: 'Collapse sidebar' }).click();
	await expect(links).toBeHidden();

	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-docs-nav', 'collapsed');
	await expect(links).toBeHidden();

	await page.getByRole('button', { name: 'Expand sidebar' }).click();
	await expect(links).toBeVisible();
});

test('the table of contents stays below the top bar at the end of a page', async ({ page }) => {
	await gotoHydrated(page, '/docs/writing-content');
	const railTop = () =>
		page.evaluate(() => {
			const rail = document.querySelector('.toc-rail')!.getBoundingClientRect();
			const bar = document.querySelector('.topbar')!.getBoundingClientRect();
			return Math.round(rail.top - bar.bottom);
		});
	const atTop = await railTop();

	await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
	await expect.poll(railTop).toBe(atTop);
});

test('theme toggle switches to light mode', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await gotoHydrated(page, '/docs');
	await page.getByRole('button', { name: 'Switch to light mode' }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('unknown routes render the error page', async ({ page }) => {
	await page.goto('/docs/does-not-exist');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
});

test('serves markdown and llms.txt for AI tools', async ({ request }) => {
	const markdown = await request.get('/docs/introduction.md');
	expect(markdown.ok()).toBe(true);
	expect(await markdown.text()).toMatch(/^# Introduction/);

	const llms = await request.get('/llms.txt');
	expect(llms.ok()).toBe(true);
	expect(await llms.text()).toContain('/docs/introduction.md');
});

import { expect, test, type Page } from '@playwright/test';

function collectErrors(page: Page): string[] {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text());
	});
	return errors;
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
	await page.goto('/docs');
	await page.getByRole('button', { name: 'Search documentation' }).click();
	await page.getByRole('combobox').fill('mermaid');

	const firstResult = page.getByRole('option').first();
	await expect(firstResult).toBeVisible();
	await firstResult.getByRole('button').click();
	await expect(page).toHaveURL(/\/docs\//);
});

test('theme toggle switches to light mode', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto('/docs');
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

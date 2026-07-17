// Provided by the contentDatesPlugin in vite.config.ts: last git commit
// date (YYYY-MM-DD) per content file, keyed as 'content/<path>'.
declare module 'virtual:svocs-content-dates' {
	const dates: Record<string, string>;
	export default dates;
}

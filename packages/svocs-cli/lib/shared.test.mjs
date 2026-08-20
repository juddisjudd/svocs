import { describe, expect, it } from 'vitest';
import { isNewerVersion } from './shared.mjs';

describe('isNewerVersion', () => {
	it('compares numerically per segment', () => {
		expect(isNewerVersion('0.21.4', '0.21.3')).toBe(true);
		expect(isNewerVersion('0.21.10', '0.21.9')).toBe(true);
		expect(isNewerVersion('1.0.0', '0.99.99')).toBe(true);
		expect(isNewerVersion('0.21.3', '0.21.3')).toBe(false);
		expect(isNewerVersion('0.20.0', '0.21.0')).toBe(false);
	});

	it('treats missing segments as zero', () => {
		expect(isNewerVersion('1.0', '1.0.0')).toBe(false);
		expect(isNewerVersion('1.0.1', '1.0')).toBe(true);
	});
});

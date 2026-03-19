import { describe, it, expect } from 'vitest';
import { stagesToCSV } from './csv.js';

describe('stagesToCSV', () => {
	it('generates correct CSV with header and rows', () => {
		const stages = [
			{ day: 1, distance: 12.34, ascent: 456, descent: 320, performanceKm: 16.9 },
			{ day: 2, distance: 8.5, ascent: 200, descent: 150, performanceKm: 10.5 }
		];

		const csv = stagesToCSV(stages);
		const lines = csv.split('\n');

		expect(lines[0]).toBe('Day,Distance (km),Ascent (m),Descent (m),Performance Distance (Lkm)');
		expect(lines[1]).toBe('Day 1,12.34,456,320,16.9');
		expect(lines[2]).toBe('Day 2,8.5,200,150,10.5');
		expect(lines.length).toBe(3);
	});

	it('handles empty stages array', () => {
		const csv = stagesToCSV([]);
		const lines = csv.split('\n');

		expect(lines.length).toBe(1); // header only
		expect(lines[0]).toBe('Day,Distance (km),Ascent (m),Descent (m),Performance Distance (Lkm)');
	});
});

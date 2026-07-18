import { describe, it, expect } from 'vitest';
import { stagesToCSV } from './csv.js';

describe('stagesToCSV', () => {
	it('generates correct CSV with transposed layout (rows=metrics, cols=days)', () => {
		const stages = [
			{ day: 1, distance: 12.34, ascent: 456, descent: 320, performanceKm: 16.9 },
			{ day: 2, distance: 8.5, ascent: 200, descent: 150, performanceKm: 10.5 }
		];

		const csv = stagesToCSV(stages);
		const lines = csv.split('\n');

		expect(lines[0]).toBe('sep=,');
		expect(lines[1]).toBe(',Day 1,Day 2,Total');
		expect(lines[2]).toBe('Distance (km),12.34,8.5,20.84');
		expect(lines[3]).toBe('Up (m),456,200,656');
		expect(lines[4]).toBe('Down (m),320,150,470');
		expect(lines[5]).toBe('Performance Distance (Lkm),16.9,10.5,27.4');
		expect(lines.length).toBe(6);
	});

	it('handles empty stages array', () => {
		const csv = stagesToCSV([]);
		const lines = csv.split('\n');

		expect(lines.length).toBe(6); // sep hint + header + 4 metric rows
		expect(lines[0]).toBe('sep=,');
		expect(lines[1]).toBe(',Total');
		expect(lines[2]).toBe('Distance (km),0');
		expect(lines[3]).toBe('Up (m),0');
		expect(lines[4]).toBe('Down (m),0');
		expect(lines[5]).toBe('Performance Distance (Lkm),0');
	});
});

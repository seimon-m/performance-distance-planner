import { describe, it, expect } from 'vitest';
import { sortWaypointsAlongTrack, calculateStages, buildStage, computeStages } from './calc.js';

describe('buildStage', () => {
	it('calculates performance km with ascent only by default (descentDivisor=0)', () => {
		// 10 km + 500 hm↑/100 + descent ignored = 10 + 5 = 15 Lkm
		const stage = buildStage(1, 10000, 500, 300);
		expect(stage.day).toBe(1);
		expect(stage.distance).toBe(10);
		expect(stage.ascent).toBe(500);
		expect(stage.descent).toBe(300);
		expect(stage.performanceKm).toBe(15);
	});

	it('includes descent when descentDivisor > 0', () => {
		// 10 km + 500 hm↑/100 + 300 hm↓/150 = 10 + 5 + 2 = 17 Lkm
		const stage = buildStage(1, 10000, 500, 300, 100, 150);
		expect(stage.performanceKm).toBe(17);
	});

	it('rounds distance to 2 decimal places', () => {
		const stage = buildStage(1, 12345, 0, 0);
		expect(stage.distance).toBe(12.35); // 12.345 rounded
	});

	it('rounds ascent and descent to whole meters', () => {
		const stage = buildStage(1, 1000, 123.7, 456.3);
		expect(stage.ascent).toBe(124);
		expect(stage.descent).toBe(456);
	});

	it('handles zero values', () => {
		const stage = buildStage(1, 0, 0, 0);
		expect(stage.distance).toBe(0);
		expect(stage.ascent).toBe(0);
		expect(stage.descent).toBe(0);
		expect(stage.performanceKm).toBe(0);
	});

	it('handles only ascent, no horizontal distance or descent', () => {
		// 0 km + 1000 hm↑/100 + 0 hm↓ = 0 + 10 + 0 = 10 Lkm
		const stage = buildStage(1, 0, 1000, 0);
		expect(stage.performanceKm).toBe(10);
	});

	it('handles only descent with explicit divisor', () => {
		// 0 km + 0 hm↑ + 750 hm↓/150 = 0 + 0 + 5 = 5 Lkm
		const stage = buildStage(1, 0, 0, 750, 100, 150);
		expect(stage.performanceKm).toBe(5);
	});
});

describe('sortWaypointsAlongTrack', () => {
	it('sorts waypoints by their nearest track point index', () => {
		// Simple track going east along equator
		const track = [
			[0, 0, 100],
			[0.01, 0, 100],
			[0.02, 0, 100],
			[0.03, 0, 100],
			[0.04, 0, 100]
		];

		// Waypoints in reverse order
		const waypoints = [
			{ name: 'B', lon: 0.03, lat: 0 },
			{ name: 'A', lon: 0.01, lat: 0 }
		];

		const sorted = sortWaypointsAlongTrack(waypoints, track);
		expect(sorted[0].name).toBe('A');
		expect(sorted[1].name).toBe('B');
		expect(sorted[0].trackIndex).toBeLessThan(sorted[1].trackIndex);
	});

	it('handles waypoints slightly off the track', () => {
		const track = [
			[8.0, 47.0, 500],
			[8.001, 47.0, 510],
			[8.002, 47.0, 520]
		];

		// Waypoint slightly north of track midpoint
		const waypoints = [{ name: 'Camp', lon: 8.001, lat: 47.0001 }];

		const sorted = sortWaypointsAlongTrack(waypoints, track);
		expect(sorted[0].trackIndex).toBe(1);
	});
});

describe('calculateStages', () => {
	it('creates stages split at waypoint track indices', () => {
		// Track: 5 points going east
		// Waypoint at track index 2 → split after index 2
		const track = [
			[8.0, 47.0, 500],
			[8.01, 47.0, 510],
			[8.02, 47.0, 520],
			[8.03, 47.0, 515],
			[8.04, 47.0, 530]
		];

		const sortedWaypoints = [
			{ name: 'Camp 1', lon: 8.02, lat: 47.0, trackIndex: 2 }
		];

		const stages = calculateStages(track, sortedWaypoints);

		expect(stages.length).toBe(2);
		expect(stages[0].day).toBe(1);
		expect(stages[1].day).toBe(2);

		// Both stages should have positive distance
		expect(stages[0].distance).toBeGreaterThan(0);
		expect(stages[1].distance).toBeGreaterThan(0);
	});

	it('creates multiple stages with multiple waypoints', () => {
		const track = [
			[8.0, 47.0, 500],
			[8.01, 47.0, 510],
			[8.02, 47.0, 520],
			[8.03, 47.0, 515],
			[8.04, 47.0, 530],
			[8.05, 47.0, 540]
		];

		const sortedWaypoints = [
			{ name: 'Camp 1', lon: 8.01, lat: 47.0, trackIndex: 1 },
			{ name: 'Camp 2', lon: 8.04, lat: 47.0, trackIndex: 4 }
		];

		const stages = calculateStages(track, sortedWaypoints);

		expect(stages.length).toBe(3);
		expect(stages[0].day).toBe(1);
		expect(stages[1].day).toBe(2);
		expect(stages[2].day).toBe(3);
	});

	it('creates a single stage when no waypoints', () => {
		const track = [
			[8.0, 47.0, 500],
			[8.01, 47.0, 510],
			[8.02, 47.0, 520]
		];

		const stages = calculateStages(track, []);

		expect(stages.length).toBe(1);
		expect(stages[0].day).toBe(1);
		expect(stages[0].distance).toBeGreaterThan(0);
		expect(stages[0].ascent).toBe(20);
	});

	it('tracks ascent and descent separately', () => {
		const track = [
			[8.0, 47.0, 500],
			[8.01, 47.0, 600], // +100
			[8.02, 47.0, 550], // -50
			[8.03, 47.0, 700]  // +150
		];

		const stages = calculateStages(track, []);

		expect(stages.length).toBe(1);
		expect(stages[0].ascent).toBe(250); // 100 + 150
		expect(stages[0].descent).toBe(50);
	});

	it('handles track without elevation data', () => {
		const track = [
			[8.0, 47.0],
			[8.01, 47.0],
			[8.02, 47.0]
		];

		const stages = calculateStages(track, []);

		expect(stages.length).toBe(1);
		expect(stages[0].ascent).toBe(0);
		expect(stages[0].distance).toBeGreaterThan(0);
	});
});

describe('computeStages (integration)', () => {
	it('produces a single stage when no waypoints are provided', () => {
		const track = [
			[8.0, 47.0, 500],
			[8.01, 47.0, 520],
			[8.02, 47.0, 540],
			[8.03, 47.0, 530],
			[8.04, 47.0, 560]
		];

		const stages = computeStages(track, []);

		expect(stages.length).toBe(1);
		expect(stages[0].day).toBe(1);
		expect(stages[0].distance).toBeGreaterThan(0);
		expect(stages[0].ascent).toBe(70); // 20+20+30
		expect(stages[0].descent).toBe(10);
		expect(stages[0].snapDistance).toBeNull();
		expect(stages[0].pointDensity).toBeGreaterThan(0);
	});

	it('sorts waypoints and computes stages end-to-end', () => {
		const track = [
			[8.0, 47.0, 500],
			[8.01, 47.0, 520],
			[8.02, 47.0, 540],
			[8.03, 47.0, 530],
			[8.04, 47.0, 560]
		];

		// Waypoints in wrong order — should be sorted by track position
		const waypoints = [
			{ name: 'Camp 2', lon: 8.03, lat: 47.0 },
			{ name: 'Camp 1', lon: 8.01, lat: 47.0 }
		];

		const stages = computeStages(track, waypoints);

		expect(stages.length).toBe(3);
		expect(stages[0].day).toBe(1);
		expect(stages[1].day).toBe(2);
		expect(stages[2].day).toBe(3);

		// All stages should have positive distance
		stages.forEach((s) => {
			expect(s.distance).toBeGreaterThan(0);
		});
	});
});

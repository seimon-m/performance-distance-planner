import { describe, it, expect } from 'vitest';
import { filterStageWaypoints, compareVariants, groupStageWaypoints, selectStageWaypoints, extractFromGeoJSON } from './gpx.js';

describe('groupStageWaypoints', () => {
	it('groups variants per night, sorted by priority', () => {
		const waypoints = [
			{ name: 'T10.1', lon: 21.0, lat: 39.0 },
			{ name: 'T10.2b', lon: 21.1, lat: 39.1 },
			{ name: 'T10.2', lon: 21.2, lat: 39.2 },
			{ name: 'T10.2a', lon: 21.3, lat: 39.3 }
		];

		const groups = groupStageWaypoints(waypoints);

		expect(groups).toHaveLength(2);
		expect(groups[0].stageNum).toBe(1);
		expect(groups[0].variants.map((v) => v.name)).toEqual(['T10.1']);
		expect(groups[1].stageNum).toBe(2);
		expect(groups[1].variants.map((v) => v.name)).toEqual(['T10.2', 'T10.2a', 'T10.2b']);
		expect(groups[1].variants.map((v) => v.variant)).toEqual(['', 'a', 'b']);
	});

	it('returns empty array when no stage pattern matches', () => {
		const waypoints = [{ name: 'Stournareika', lon: 21.0, lat: 39.0 }];
		expect(groupStageWaypoints(waypoints)).toEqual([]);
	});

	it('excludes other prefixes from groups', () => {
		const waypoints = [
			{ name: 'T10.1', lon: 21.0, lat: 39.0 },
			{ name: 'H10.1', lon: 21.1, lat: 39.1 }
		];

		const groups = groupStageWaypoints(waypoints);
		expect(groups).toHaveLength(1);
		expect(groups[0].variants[0].name).toBe('T10.1');
	});
});

describe('selectStageWaypoints', () => {
	const groups = groupStageWaypoints([
		{ name: 'T10.1', lon: 21.0, lat: 39.0 },
		{ name: 'T10.2', lon: 21.1, lat: 39.1 },
		{ name: 'T10.2a', lon: 21.2, lat: 39.2 },
		{ name: 'T10.2b', lon: 21.3, lat: 39.3 }
	]);

	it('defaults to the preferred variant per night', () => {
		const result = selectStageWaypoints(groups);
		expect(result.map((wp) => wp.name)).toEqual(['T10.1', 'T10.2']);
	});

	it('honors an explicit selection', () => {
		const result = selectStageWaypoints(groups, { 2: 'b' });
		expect(result.map((wp) => wp.name)).toEqual(['T10.1', 'T10.2b']);
	});

	it('falls back to preferred variant for unknown selections', () => {
		const result = selectStageWaypoints(groups, { 2: 'z' });
		expect(result.map((wp) => wp.name)).toEqual(['T10.1', 'T10.2']);
	});

	it('returns plain waypoints without variant metadata', () => {
		const result = selectStageWaypoints(groups, { 2: 'a' });
		expect(result[1]).toEqual({ name: 'T10.2a', lon: 21.2, lat: 39.2 });
	});
});

describe('compareVariants', () => {
	it('prefers no variant over any letter', () => {
		expect(compareVariants('', 'a')).toBeLessThan(0);
		expect(compareVariants('', 'b')).toBeLessThan(0);
	});

	it('prefers a over b', () => {
		expect(compareVariants('a', 'b')).toBeLessThan(0);
	});

	it('prefers b over c', () => {
		expect(compareVariants('b', 'c')).toBeLessThan(0);
	});

	it('returns 0 for equal variants', () => {
		expect(compareVariants('a', 'a')).toBe(0);
		expect(compareVariants('', '')).toBe(0);
	});

	it('returns positive when second is preferred', () => {
		expect(compareVariants('b', 'a')).toBeGreaterThan(0);
		expect(compareVariants('a', '')).toBeGreaterThan(0);
	});
});

describe('filterStageWaypoints', () => {
	it('filters out non-stage waypoints', () => {
		const waypoints = [
			{ name: 'Stournareika', lon: 21.48, lat: 39.45 },
			{ name: 'T10.1', lon: 21.14, lat: 39.82 },
			{ name: 'W10.1', lon: 21.0, lat: 39.9 },
			{ name: 'T10.2', lon: 21.12, lat: 39.87 },
			{ name: 'H10.1', lon: 21.0, lat: 39.8 },
			{ name: 'Quelle', lon: 21.0, lat: 39.7 }
		];

		const result = filterStageWaypoints(waypoints);
		expect(result).toHaveLength(2);
		expect(result[0].name).toBe('T10.1');
		expect(result[1].name).toBe('T10.2');
	});

	it('picks variant a over b and c', () => {
		const waypoints = [
			{ name: 'T10.3c', lon: 21.0, lat: 39.0 },
			{ name: 'T10.3a', lon: 21.1, lat: 39.1 },
			{ name: 'T10.3b', lon: 21.2, lat: 39.2 }
		];

		const result = filterStageWaypoints(waypoints);
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('T10.3a');
	});

	it('prefers no-letter variant over lettered ones', () => {
		const waypoints = [
			{ name: 'T10.6', lon: 21.0, lat: 39.0 },
			{ name: 'T10.6a', lon: 21.1, lat: 39.1 }
		];

		const result = filterStageWaypoints(waypoints);
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('T10.6');
	});

	it('falls back to b if no a exists', () => {
		const waypoints = [
			{ name: 'T10.9b', lon: 21.0, lat: 39.0 },
			{ name: 'T10.9c', lon: 21.1, lat: 39.1 }
		];

		const result = filterStageWaypoints(waypoints);
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('T10.9b');
	});

	it('sorts results by stage number', () => {
		const waypoints = [
			{ name: 'T10.5a', lon: 21.5, lat: 39.5 },
			{ name: 'T10.1', lon: 21.1, lat: 39.1 },
			{ name: 'T10.3a', lon: 21.3, lat: 39.3 }
		];

		const result = filterStageWaypoints(waypoints);
		expect(result).toHaveLength(3);
		expect(result[0].name).toBe('T10.1');
		expect(result[1].name).toBe('T10.3a');
		expect(result[2].name).toBe('T10.5a');
	});

	it('prefers T-prefix over more frequent W-prefix', () => {
		const waypoints = [
			{ name: 'T10.1', lon: 21.0, lat: 39.0 },
			{ name: 'T10.2', lon: 21.1, lat: 39.1 },
			{ name: 'W10.1', lon: 21.2, lat: 39.2 },
			{ name: 'W10.2', lon: 21.3, lat: 39.3 },
			{ name: 'W10.3', lon: 21.4, lat: 39.4 },
			{ name: 'W10.4', lon: 21.5, lat: 39.5 },
			{ name: 'H10.1', lon: 21.6, lat: 39.6 }
		];

		const result = filterStageWaypoints(waypoints);
		// T10 preferred even though W10 has more entries
		expect(result).toHaveLength(2);
		expect(result.every((wp) => wp.name.startsWith('T10.'))).toBe(true);
	});

	it('falls back to most frequent prefix if no T-prefix exists', () => {
		const waypoints = [
			{ name: 'S5.1', lon: 21.0, lat: 39.0 },
			{ name: 'S5.2', lon: 21.1, lat: 39.1 },
			{ name: 'S5.3', lon: 21.2, lat: 39.2 },
			{ name: 'W5.1', lon: 21.3, lat: 39.3 }
		];

		const result = filterStageWaypoints(waypoints);
		expect(result).toHaveLength(3);
		expect(result.every((wp) => wp.name.startsWith('S5.'))).toBe(true);
	});

	it('returns all waypoints as fallback if no stage pattern found', () => {
		const waypoints = [
			{ name: 'Stournareika', lon: 21.0, lat: 39.0 },
			{ name: 'Vatsounia', lon: 21.1, lat: 39.1 }
		];

		const result = filterStageWaypoints(waypoints);
		expect(result).toHaveLength(2);
	});

	it('matches underscore+uppercase variants (T04.3_A style)', () => {
		const waypoints = [
			{ name: 'T04.1', lon: 21.0, lat: 39.0 },
			{ name: 'T04.2', lon: 21.1, lat: 39.1 },
			{ name: 'T04.3_A', lon: 21.2, lat: 39.2 },
			{ name: 'T04.3_B', lon: 21.3, lat: 39.3 },
			{ name: 'T04.4', lon: 21.4, lat: 39.4 },
			{ name: 'T04.5_A', lon: 21.5, lat: 39.5 },
			{ name: 'T04.5_B', lon: 21.6, lat: 39.6 },
			{ name: 'T04.6', lon: 21.7, lat: 39.7 },
			{ name: 'T04.7', lon: 21.8, lat: 39.8 },
			{ name: 'T04.8_A', lon: 21.9, lat: 39.9 }
		];

		const result = filterStageWaypoints(waypoints);
		const names = result.map((r) => r.name);
		expect(names).toEqual([
			'T04.1', 'T04.2', 'T04.3_A', 'T04.4', 'T04.5_A',
			'T04.6', 'T04.7', 'T04.8_A'
		]);
	});

	it('prefers no-variant over underscore+uppercase variant', () => {
		const waypoints = [
			{ name: 'T04.3', lon: 21.0, lat: 39.0 },
			{ name: 'T04.3_A', lon: 21.1, lat: 39.1 },
			{ name: 'T04.3_B', lon: 21.2, lat: 39.2 }
		];

		const result = filterStageWaypoints(waypoints);
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('T04.3');
	});

	it('handles complex real-world mix of waypoints', () => {
		const waypoints = [
			{ name: 'Stournareika', lon: 21.48, lat: 39.45 },
			{ name: 'Vatsounia', lon: 21.58, lat: 39.41 },
			{ name: 'T10.1', lon: 21.14, lat: 39.82 },
			{ name: 'T10.2', lon: 21.12, lat: 39.87 },
			{ name: 'T10.3a', lon: 21.04, lat: 39.95 },
			{ name: 'T10.3b', lon: 21.05, lat: 39.94 },
			{ name: 'T10.3c', lon: 21.06, lat: 39.93 },
			{ name: 'T10.3d', lon: 21.07, lat: 39.92 },
			{ name: 'T10.3e', lon: 21.08, lat: 39.91 },
			{ name: 'T10.4a', lon: 21.01, lat: 40.02 },
			{ name: 'T10.4b', lon: 21.02, lat: 40.01 },
			{ name: 'T10.4c', lon: 21.03, lat: 40.00 },
			{ name: 'W10.5', lon: 21.0, lat: 39.9 },
			{ name: 'H10.3', lon: 21.0, lat: 39.8 },
			{ name: 'T10.5a', lon: 21.01, lat: 40.10 },
			{ name: 'T10.5b', lon: 21.03, lat: 40.08 },
			{ name: 'T10.6', lon: 20.90, lat: 40.08 },
			{ name: 'T10.7a', lon: 20.85, lat: 39.99 },
			{ name: 'T10.7b', lon: 20.86, lat: 39.98 },
			{ name: 'T10.8', lon: 20.77, lat: 39.97 },
			{ name: 'T10.9a', lon: 20.72, lat: 39.95 },
			{ name: 'T10.9b', lon: 20.71, lat: 39.94 },
			{ name: 'Quelle', lon: 21.0, lat: 39.7 }
		];

		const result = filterStageWaypoints(waypoints);

		// Should have exactly 9 stages: 1, 2, 3a, 4a, 5a, 6, 7a, 8, 9a
		expect(result).toHaveLength(9);
		const names = result.map((r) => r.name);
		expect(names).toEqual([
			'T10.1', 'T10.2', 'T10.3a', 'T10.4a', 'T10.5a',
			'T10.6', 'T10.7a', 'T10.8', 'T10.9a'
		]);
	});
});

describe('duplicate waypoint names', () => {
	it('throws a naming error when the same spot name appears twice', () => {
		const waypoints = [
			{ name: 'T10.1', lon: 21.0, lat: 39.0 },
			{ name: 'T10.2', lon: 21.1, lat: 39.1 },
			{ name: 'T10.2', lon: 21.2, lat: 39.2 }
		];

		expect(() => groupStageWaypoints(waypoints)).toThrow(/Naming issue: T10\.2 appears 2 times/);
		expect(() => groupStageWaypoints(waypoints)).toThrow(/Team K&R is happy when you improve the naming :\)/);
	});

	it('throws when two spellings resolve to the same night and variant', () => {
		const waypoints = [
			{ name: 'T10.3a', lon: 21.0, lat: 39.0 },
			{ name: 'T10.3_A', lon: 21.1, lat: 39.1 }
		];

		expect(() => groupStageWaypoints(waypoints)).toThrow(/T10\.3a and T10\.3_A name the same spot/);
	});

	it('lists every clash in one error', () => {
		const waypoints = [
			{ name: 'T10.1', lon: 21.0, lat: 39.0 },
			{ name: 'T10.1', lon: 21.1, lat: 39.1 },
			{ name: 'T10.4b', lon: 21.2, lat: 39.2 },
			{ name: 'T10.4b', lon: 21.3, lat: 39.3 }
		];

		expect(() => groupStageWaypoints(waypoints)).toThrow(/T10\.1 appears 2 times; T10\.4b appears 2 times/);
	});

	it('does not throw for duplicates outside the detected prefix', () => {
		const waypoints = [
			{ name: 'T10.1', lon: 21.0, lat: 39.0 },
			{ name: 'F10.4', lon: 21.1, lat: 39.1 },
			{ name: 'F10.4', lon: 21.2, lat: 39.2 }
		];

		const groups = groupStageWaypoints(waypoints);
		expect(groups).toHaveLength(1);
	});
});

describe('extractFromGeoJSON warnings', () => {
	function point(name, lon, lat) {
		return {
			type: 'Feature',
			properties: { name },
			geometry: { type: 'Point', coordinates: [lon, lat] }
		};
	}

	function line(name, coordinates) {
		return {
			type: 'Feature',
			properties: { name },
			geometry: { type: 'LineString', coordinates }
		};
	}

	const mainLine = line('Route 0', [[21.0, 39.0, 500], [21.1, 39.1, 520]]);

	it('returns no warnings for a clean single-track file', () => {
		const { warnings } = extractFromGeoJSON({
			type: 'FeatureCollection',
			features: [mainLine, point('T10.1', 21.05, 39.05)]
		});

		expect(warnings).toEqual([]);
	});

	it('warns when the file contains several route lines', () => {
		const { track, warnings } = extractFromGeoJSON({
			type: 'FeatureCollection',
			features: [mainLine, line('S10.1', [[22.0, 40.0], [22.1, 40.1]])]
		});

		expect(track).toHaveLength(2);
		expect(warnings).toEqual([
			'The file contains 2 route lines — measurements follow “Route 0” only.'
		]);
	});

	it('warns about duplicate names among unused points', () => {
		const { warnings } = extractFromGeoJSON({
			type: 'FeatureCollection',
			features: [
				mainLine,
				point('T10.1', 21.05, 39.05),
				point('F10.4', 21.06, 39.06),
				point('F10.4', 21.07, 39.07)
			]
		});

		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain('F10.4 appears 2 times');
		expect(warnings[0]).toContain('Team K&R is happy when you improve the naming :)');
	});

	it('propagates the naming error for stage spot duplicates', () => {
		const collection = {
			type: 'FeatureCollection',
			features: [mainLine, point('T10.1', 21.05, 39.05), point('T10.1', 21.06, 39.06)]
		};

		expect(() => extractFromGeoJSON(collection)).toThrow(/Naming issue/);
	});
});

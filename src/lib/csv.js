/**
 * Convert stage results to a CSV string.
 *
 * Layout: rows = metrics, columns = Day 1…N + Total (matching spreadsheet view).
 *
 * @param {Array<{ day: number, distance: number, ascent: number, descent: number, performanceKm: number }>} stages
 * @returns {string} CSV content
 */
export function stagesToCSV(stages) {
	const dayHeaders = stages.map((s) => `Day ${s.day}`);
	const header = ['', ...dayHeaders, 'Total'].join(',');

	const totalDist = Math.round(stages.reduce((sum, s) => sum + s.distance, 0) * 100) / 100;
	const totalAscent = stages.reduce((sum, s) => sum + s.ascent, 0);
	const totalDescent = stages.reduce((sum, s) => sum + s.descent, 0);
	const totalLkm = Math.round(stages.reduce((sum, s) => sum + s.performanceKm, 0) * 100) / 100;

	const distRow = ['Distance (km)', ...stages.map((s) => s.distance), totalDist].join(',');
	const ascentRow = ['Up (m)', ...stages.map((s) => s.ascent), totalAscent].join(',');
	const descentRow = ['Down (m)', ...stages.map((s) => s.descent), totalDescent].join(',');
	const lkmRow = ['Performance Distance (Lkm)', ...stages.map((s) => s.performanceKm), totalLkm].join(',');

	return [header, distRow, ascentRow, descentRow, lkmRow].join('\n');
}

/**
 * Trigger a CSV file download in the browser.
 *
 * @param {string} csvContent - CSV string
 * @param {string} [filename='etappen.csv'] - Download filename
 */
export function downloadCSV(csvContent, filename = 'stages.csv') {
	const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

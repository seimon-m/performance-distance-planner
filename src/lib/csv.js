/**
 * Convert stage results to a CSV string.
 *
 * @param {Array<{ day: number, distance: number, ascent: number, performanceKm: number }>} stages
 * @returns {string} CSV content
 */
export function stagesToCSV(stages) {
	const header = 'Day,Distance (km),Ascent (m),Descent (m),Performance Distance (Lkm)';
	const rows = stages.map(
		(s) => `Day ${s.day},${s.distance},${s.ascent},${s.descent},${s.performanceKm}`
	);
	const totalDist = Math.round(stages.reduce((sum, s) => sum + s.distance, 0) * 10) / 10;
	const totalAscent = stages.reduce((sum, s) => sum + s.ascent, 0);
	const totalDescent = stages.reduce((sum, s) => sum + s.descent, 0);
	const totalLkm = Math.round(stages.reduce((sum, s) => sum + s.performanceKm, 0) * 10) / 10;
	const totals = `Total,${totalDist},${totalAscent},${totalDescent},${totalLkm}`;
	return [header, ...rows, totals].join('\n');
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

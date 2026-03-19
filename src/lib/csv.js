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
	return [header, ...rows].join('\n');
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

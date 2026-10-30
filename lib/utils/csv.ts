/**
 * CSV for downloads: comma-separated, CRLF line endings, each cell quoted
 * when it needs to be, and cells starting =, +, - or @ prefixed with ' so a
 * spreadsheet never runs them as formulas.
 */
export function toCsv(rows: readonly (readonly (string | number | null | undefined)[])[]): string {
	return `${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

function csvCell(value: string | number | null | undefined): string {
	let text = value == null ? "" : String(value);
	if (/^[=+\-@]/.test(text)) text = `'${text}`;
	return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** The response headers for a CSV download with this file name. */
export function csvHeaders(fileName: string): HeadersInit {
	return {
		"Content-Type": "text/csv; charset=utf-8",
		"Content-Disposition": `attachment; filename="${fileName.replace(/[^\w.-]/g, "-")}"`,
	};
}

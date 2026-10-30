import "server-only";

import {
	getImportView,
	getReport,
	type ImportView,
	refreshReport,
} from "@/services/replacements/laptops/lib/import";
import { queueLength } from "@/services/replacements/laptops/lib/queue";

export type ImportData = {
	view: ImportView | null;
	queued: number;
	/** Set when the first load of the report from Halo failed. */
	firstLoadFailed: string | null;
};

/**
 * What every Import tab needs: the saved Halo report sorted into eligible,
 * needs attention and hidden, and the queue length. The report is fetched
 * from Halo only if there isn't one yet.
 */
export async function loadImport(actorId: string): Promise<ImportData> {
	let report = await getReport();
	let firstLoadFailed: string | null = null;
	if (!report) {
		const result = await refreshReport(actorId, {
			kind: "user",
			label: "Import (first load)",
			actorUserId: actorId,
		});
		if (result.ok) report = await getReport();
		else firstLoadFailed = result.failure.message;
	}
	const [view, queued] = await Promise.all([
		report ? getImportView(report) : null,
		queueLength(),
	]);
	return { view, queued, firstLoadFailed };
}

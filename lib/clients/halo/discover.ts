import "server-only";

import type { CallContext, CallResult } from "@/lib/clients/connection-log";
import { callHalo } from "@/lib/clients/halo";

/**
 * Read-only lookups for the Halo settings pages, so people choose reports,
 * fields, statuses and values by name and never type an ID. Any service
 * can use them. Each is one logged call, made only when a settings page
 * that needs it is opened.
 */

export type HaloOption = { value: string; label: string };

type Named = { id: number; name: string };

/** Signs in and reads one user: proves the site, credentials and scope work. */
export function testHaloConnection(context: CallContext): Promise<CallResult<{ users: number }>> {
	return callHalo(context, async (halo) => {
		const body = await halo.get<{ record_count?: number }>("/Users", {
			pageinate: true,
			page_size: 1,
			page_no: 1,
		});
		const users = Number(body.record_count ?? 0);
		return { value: { users }, summary: `Connection test: ${users} users` };
	});
}

/** Every report, by name. Halo returns at most 50 a page, so this reads every page. */
export function listHaloReports(context: CallContext): Promise<CallResult<HaloOption[]>> {
	return callHalo(context, async (halo) => {
		const all: Named[] = [];
		for (let page = 1; page <= 100; page++) {
			const body = await halo.get<Named[] | { reports?: Named[] }>("/Report", {
				showall: true,
				pageinate: true,
				page_size: 50,
				page_no: page,
			});
			const batch = Array.isArray(body) ? body : (body.reports ?? []);
			all.push(...batch);
			if (batch.length < 50) break;
		}
		const reports = all
			.map((r) => ({ value: String(r.id), label: `${r.name.trim()} (${r.id})` }))
			.sort((a, b) => a.label.localeCompare(b.label));
		return { value: reports, summary: `Reports: ${reports.length}` };
	});
}

/** Every asset type, by name. */
export function listHaloAssetTypes(context: CallContext): Promise<CallResult<HaloOption[]>> {
	return callHalo(context, async (halo) => {
		const body = await halo.get<Named[]>("/AssetType", { showall: true });
		const types = body
			.map((t) => ({ value: String(t.id), label: t.name.trim() }))
			.sort((a, b) => a.label.localeCompare(b.label));
		return { value: types, summary: `Asset types: ${types.length}` };
	});
}

export type HaloAssetTypeDetails = {
	/** The asset type's fields, by name. */
	fields: HaloOption[];
	/** For fields that are lists: the options, by field ID. */
	lookups: Record<string, HaloOption[]>;
	/** Statuses seen on assets of this type, by name. */
	statuses: HaloOption[];
};

type AssetField = { id: number; name: string; lookup?: number };

/**
 * An asset type's fields, the options of its list fields, and its statuses.
 * Halo has no status list, so statuses are collected from up to 200 assets
 * of the type (one detail read per status found, for its name).
 */
export function getHaloAssetTypeDetails(
	typeId: number,
	context: CallContext,
): Promise<CallResult<HaloAssetTypeDetails>> {
	return callHalo(context, async (halo) => {
		const type = await halo.get<{
			fields?: { field_id?: number; id: number; field_name?: string }[];
		}>(`/AssetType/${typeId}`, { includedetails: true });
		const fields = (type.fields ?? [])
			.map((f) => ({ value: String(f.field_id ?? f.id), label: (f.field_name ?? "").trim() }))
			.filter((f) => f.label)
			.sort((a, b) => a.label.localeCompare(b.label));

		const sampleIds = new Map<number, number>();
		for (let page = 1; page <= 4; page++) {
			const body = await halo.get<{ assets?: { id: number; status_id: number }[] }>(
				"/Asset",
				{
					assettype_id: typeId,
					pageinate: true,
					page_size: 50,
					page_no: page,
				},
			);
			const assets = body.assets ?? [];
			for (const asset of assets) {
				if (!sampleIds.has(asset.status_id)) sampleIds.set(asset.status_id, asset.id);
			}
			if (assets.length < 50) break;
		}

		const statuses: HaloOption[] = [];
		const lookupIds = new Map<number, number>();
		for (const [statusId, assetId] of sampleIds) {
			const asset = await halo.get<{ status_name?: string; fields?: AssetField[] }>(
				`/Asset/${assetId}`,
			);
			statuses.push({
				value: String(statusId),
				label: asset.status_name ?? `Status ${statusId}`,
			});
			for (const f of asset.fields ?? []) if (f.lookup) lookupIds.set(f.id, f.lookup);
		}
		statuses.sort((a, b) => Number(a.value) - Number(b.value));

		const lookups: Record<string, HaloOption[]> = {};
		for (const [fieldId, lookupId] of lookupIds) {
			const options = await halo.get<Named[]>("/Lookup", { lookupid: lookupId });
			lookups[String(fieldId)] = options.map((o) => ({ value: String(o.id), label: o.name }));
		}
		return {
			value: { fields, lookups, statuses },
			summary: `Asset type ${typeId}: ${fields.length} fields, ${statuses.length} statuses`,
		};
	});
}

export type HaloUserFields = {
	/** Standard user fields ("samaccountname") and custom fields ("custom:1166"), by name. */
	options: HaloOption[];
	/** One staff record, for showing what each mapping gives. Only shown on the settings page. */
	sample: Record<string, unknown> | null;
};

/** The fields on a Halo user, read from one staff record that has an Entra ID. */
export function listHaloUserFields(context: CallContext): Promise<CallResult<HaloUserFields>> {
	return callHalo<HaloUserFields>(context, async (halo) => {
		const { users } = await halo.get<{
			users?: { id: number; azureoid?: string; inactive?: boolean }[];
		}>("/Users", { pageinate: true, page_size: 50, page_no: 1, search: "@" });
		const pick = (users ?? []).find((u) => u.azureoid && !u.inactive);
		if (!pick)
			return {
				value: { options: [], sample: null },
				summary: "User fields: no staff record found",
			};
		const sample = await halo.get<Record<string, unknown> & { customfields?: AssetField[] }>(
			`/Users/${pick.id}`,
		);
		const standard = Object.entries(sample)
			.filter(
				([key, value]) =>
					key !== "customfields" &&
					(value === null || typeof value !== "object" || Array.isArray(value)),
			)
			.map(([key]) => ({ value: key, label: key }));
		const custom = (sample.customfields ?? []).map((f) => ({
			value: `custom:${f.id}`,
			label: `${(f as AssetField & { label?: string }).label ?? f.name} (custom field ${f.id})`,
		}));
		const options = [...custom, ...standard].sort((a, b) => a.label.localeCompare(b.label));
		return { value: { options, sample }, summary: `User fields: ${options.length}` };
	});
}

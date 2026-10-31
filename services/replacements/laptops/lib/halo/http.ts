import "server-only";

import { callHalo } from "@/lib/clients/halo";
import type { HaloHttp } from "@/lib/clients/halo/http";
import type {
	AuditedUpdate,
	HaloAssignedDevice,
	HaloEndOfLifeDevice,
	HaloStockDevice,
	LaptopHaloClient,
} from "./index";
import { fillNote, getLaptopHaloSettings, type LaptopHaloSettings } from "./settings";

/**
 * Laptop replacements' requests to the real Halo. Every report, asset type,
 * status, field and lookup ID comes from Settings › Halo
 * (`getLaptopHaloSettings`), read at the start of each call; nothing about
 * BCP's Halo is fixed here. Each method is one logged call; its summary
 * lists the requests made.
 *
 * The portal's asset ID (and a replacement's box number) is Halo's asset
 * `id`, such as 26620. The serial number is the asset's `inventory_number`
 * (the same as its Serial Number field).
 */

/** Halo returns at most 50 records a page, whatever is asked for. */
const PAGE_SIZE = 50;

type HaloField = { id: number; name?: string; value?: unknown; display?: string };

type HaloAssetListItem = {
	id: number;
	inventory_number: string;
	key_field: string;
	key_field2: string;
	key_field3: string;
	status_id: number;
	assettype_name?: string;
	supplier_purchasedate?: string;
};

type HaloAsset = HaloAssetListItem & {
	fields?: HaloField[];
	users?: { name: string; emailaddress: string }[];
};

type ReportRow = Record<string, string | number | null>;

function text(value: unknown): string {
	return value == null ? "" : String(value).trim();
}

/** "2021-03-04T00:00:00" or "04/03/2021" as YYYY-MM-DD; "" when missing or unreadable. */
function isoDay(value: unknown): string {
	const raw = text(value);
	const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
	if (iso) return iso[1];
	const uk = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
	return uk ? `${uk[3]}-${uk[2]}-${uk[1]}` : "";
}

function field(asset: HaloAsset, id: number): HaloField | undefined {
	return asset.fields?.find((f) => f.id === id);
}

/** Every page of a list request. */
async function allPages<T>(
	halo: HaloHttp,
	path: string,
	key: string,
	query: Record<string, string | number>,
): Promise<T[]> {
	const items: T[] = [];
	for (let page = 1; ; page++) {
		const body = await halo.get<Record<string, unknown>>(path, {
			...query,
			pageinate: true,
			page_size: PAGE_SIZE,
			page_no: page,
		});
		const batch = (body[key] as T[] | undefined) ?? [];
		items.push(...batch);
		const total = Number(body.record_count ?? 0);
		if (!batch.length || items.length >= total) return items;
	}
}

/** The laptop with this serial (inventory number), or null. More than one match is an error, not a guess. */
async function findBySerial(
	halo: HaloHttp,
	settings: LaptopHaloSettings,
	serial: string,
): Promise<HaloAssetListItem | null> {
	const { assets } = await halo.get<{ assets: HaloAssetListItem[] }>("/Asset", {
		assettype_id: settings.laptopTypeId,
		search: serial,
		pageinate: true,
		page_size: 5,
		page_no: 1,
	});
	const matches = assets.filter((a) => text(a.inventory_number) === serial.trim());
	if (matches.length > 1) {
		throw new Error(`More than one laptop in Halo has serial number ${serial}`);
	}
	return matches[0] ?? null;
}

/** A laptop by its Halo asset ID; refuses anything that isn't a laptop, before any update. */
async function getLaptop(
	halo: HaloHttp,
	settings: LaptopHaloSettings,
	assetId: string,
): Promise<HaloAsset> {
	if (!/^\d+$/.test(assetId)) throw new Error(`${assetId} is not a Halo asset ID`);
	const asset = await halo.get<HaloAsset & { assettype_id: number }>(`/Asset/${assetId}`);
	if (asset.assettype_id !== settings.laptopTypeId) {
		throw new Error(`Halo asset ${assetId} is not a laptop, so nothing was changed`);
	}
	return asset;
}

/** Halo updates with POST: an array, and a record with an id is updated. */
async function updateAsset(
	halo: HaloHttp,
	asset: HaloAsset,
	changes: { status_id?: number; fields: { id: number; value: string | number | null }[] },
): Promise<void> {
	await halo.post("/Asset", [{ id: asset.id, ...changes }]);
}

function toEndOfLife(row: ReportRow, assetId: string): HaloEndOfLifeDevice {
	const serial = text(row["Serial Number"]);
	const name = text(row["Full Name"]);
	const email = text(row["Email Address"]).toLowerCase();
	return {
		assetId,
		serial,
		hostname: text(row["Device Hostname"]),
		make: text(row.Manufacturer) || null,
		model: text(row.Model),
		purchaseDate: isoDay(row["Supplier Purchase Date"]),
		lastSeen: text(row["Last Sync Time"]),
		assignedUser: email ? { name: name || email, email } : null,
	};
}

function assetToEndOfLife(asset: HaloAsset, settings: LaptopHaloSettings): HaloEndOfLifeDevice {
	const user = asset.users?.[0];
	return {
		assetId: String(asset.id),
		serial: text(asset.inventory_number) || text(field(asset, settings.fieldSerial)?.value),
		hostname: text(asset.key_field),
		make: text(asset.key_field2) || null,
		model: text(asset.key_field3),
		purchaseDate: isoDay(asset.supplier_purchasedate),
		lastSeen: settings.fieldLastSync ? text(field(asset, settings.fieldLastSync)?.value) : "",
		assignedUser: user?.emailaddress
			? { name: text(user.name), email: text(user.emailaddress).toLowerCase() }
			: null,
	};
}

export function createHttpLaptopHaloClient(): LaptopHaloClient {
	return {
		listEndOfLifeDevices: (context) =>
			callHalo(context, async (halo) => {
				const settings = await getLaptopHaloSettings();
				const report = await halo.get<{ report?: { rows?: ReportRow[] } }>(
					`/Report/${settings.eligibleReportId}`,
					{ loadreport: true },
				);
				const rows = (report.report?.rows ?? []).filter((row) =>
					text(row["Serial Number"]),
				);
				// Each laptop's Halo ID: from report 566 once it has an ID column,
				// otherwise from report 571, otherwise looked up one at a time.
				const ids = new Map<string, string>();
				for (const row of rows) {
					const id = text(row.ID ?? row["Asset ID"]);
					if (id) ids.set(text(row["Serial Number"]), id);
				}
				if (ids.size < rows.length && settings.idsReportId) {
					const all = await halo.get<{ report?: { rows?: ReportRow[] } }>(
						`/Report/${settings.idsReportId}`,
						{ loadreport: true },
					);
					for (const row of all.report?.rows ?? []) {
						const serial = text(row["Serial Number"]);
						if (serial && !ids.has(serial)) ids.set(serial, text(row.ID));
					}
				}
				let lookedUp = 0;
				for (const row of rows) {
					const serial = text(row["Serial Number"]);
					if (ids.get(serial)) continue;
					lookedUp += 1;
					const asset = await findBySerial(halo, settings, serial);
					if (asset) ids.set(serial, String(asset.id));
				}
				const devices = rows
					.filter((row) => ids.get(text(row["Serial Number"])))
					.map((row) => toEndOfLife(row, ids.get(text(row["Serial Number"])) as string));
				const missing = rows.length - devices.length;
				return {
					value: devices,
					summary: `End-of-life report: ${devices.length} laptops${lookedUp ? `, ${lookedUp} looked up by serial` : ""}${missing ? `, ${missing} not found in Halo` : ""}`,
				};
			}),

		findDeviceBySerial: (serial, context) =>
			callHalo(context, async (halo) => {
				const settings = await getLaptopHaloSettings();
				const match = await findBySerial(halo, settings, serial);
				if (!match) return { value: null, summary: "Serial lookup: not found" };
				const device = assetToEndOfLife(
					await halo.get<HaloAsset>(`/Asset/${match.id}`),
					settings,
				);
				return { value: device, summary: `Serial lookup: found asset ${device.assetId}` };
			}),

		devicesAssignedTo: (email, context) =>
			callHalo(context, async (halo) => {
				const { users } = await halo.get<{ users: { id: number; emailaddress: string }[] }>(
					"/Users",
					{ search: email, pageinate: true, page_size: 5, page_no: 1 },
				);
				const user = users.find(
					(u) => text(u.emailaddress).toLowerCase() === email.toLowerCase(),
				);
				if (!user) return { value: [], summary: "Assigned devices: person not in Halo" };
				const assets = await allPages<HaloAssetListItem>(halo, "/Asset", "assets", {
					username: user.id,
				});
				const devices: HaloAssignedDevice[] = assets.map((a) => ({
					assetId: String(a.id),
					assetType: text(a.assettype_name),
					serial: text(a.inventory_number),
					hostname: text(a.key_field),
					model: text(a.key_field3),
					lastSeen: "",
				}));
				return { value: devices, summary: `Assigned devices: ${devices.length}` };
			}),

		listStock: (context) =>
			callHalo(context, async (halo) => {
				const settings = await getLaptopHaloSettings();
				if (settings.stockReportId) {
					// The stock report: one request. It needs ID and Serial Number columns.
					const body = await halo.get<{ report?: { rows?: ReportRow[] } }>(
						`/Report/${settings.stockReportId}`,
						{ loadreport: true },
					);
					const devices: HaloStockDevice[] = (body.report?.rows ?? [])
						.filter((row) => text(row.ID ?? row["Asset ID"]))
						.map((row) => ({
							assetId: text(row.ID ?? row["Asset ID"]),
							serial: text(row["Serial Number"]),
							hostname: text(row["Device Name"] ?? row["Device Hostname"]),
							model: [text(row.Manufacturer), text(row.Model)]
								.filter(Boolean)
								.join(" "),
							stockLocation: text(row["Stock Location"]),
							stockRoom: text(row["Stock Room"]),
						}));
					return { value: devices, summary: `Stock report: ${devices.length} laptops` };
				}
				// No stock report: every laptop at the in-stock status, 50 at a time.
				// The list has the key fields (Device Name, Manufacturer, Model) but
				// not Stock Location or Room.
				const assets = await allPages<HaloAssetListItem>(halo, "/Asset", "assets", {
					assettype_id: settings.laptopTypeId,
					assetstatuses: settings.statusInStock,
				});
				const devices: HaloStockDevice[] = assets
					.filter((a) => text(a.inventory_number))
					.map((a) => ({
						assetId: String(a.id),
						serial: text(a.inventory_number),
						hostname: text(a.key_field),
						model: [text(a.key_field2), text(a.key_field3)].filter(Boolean).join(" "),
						stockLocation: "",
						stockRoom: "",
					}));
				return { value: devices, summary: `Stock: ${devices.length} laptops` };
			}),

		issueDevice: (device: AuditedUpdate, context) =>
			callHalo(context, async (halo) => {
				const settings = await getLaptopHaloSettings();
				const asset = await getLaptop(halo, settings, device.assetId);
				await updateAsset(halo, asset, {
					status_id: settings.statusInService,
					fields: [
						{ id: settings.fieldStockLocation, value: null },
						{ id: settings.fieldStockRoom, value: null },
						{ id: settings.fieldLastAuditDate, value: device.date },
						{
							id: settings.fieldAuditDetails,
							value: fillNote(settings.collectedNote, device),
						},
					],
				});
				return { value: undefined, summary: `Box ${device.assetId} In Service` };
			}),

		markOldDeviceReturned: (device: AuditedUpdate, context) =>
			callHalo(context, async (halo) => {
				const settings = await getLaptopHaloSettings();
				const asset = await getLaptop(halo, settings, device.assetId);
				await updateAsset(halo, asset, {
					fields: [
						{ id: settings.fieldStockRoom, value: settings.roomReturned },
						{ id: settings.fieldLastAuditDate, value: device.date },
						{
							id: settings.fieldAuditDetails,
							value: fillNote(settings.returnedNote, device),
						},
					],
				});
				return {
					value: undefined,
					summary: `Asset ${device.assetId} returned`,
				};
			}),

		decommissionDevice: (device, context) =>
			callHalo(context, async (halo) => {
				const settings = await getLaptopHaloSettings();
				const asset = await getLaptop(halo, settings, device.assetId);
				await updateAsset(halo, asset, {
					status_id: settings.statusOutOfService,
					fields: [
						{ id: settings.fieldStockLocation, value: settings.locationDecommissioned },
						{ id: settings.fieldStockRoom, value: settings.roomReturned },
					],
				});
				return { value: undefined, summary: `Asset ${device.assetId} decommissioned` };
			}),
	};
}

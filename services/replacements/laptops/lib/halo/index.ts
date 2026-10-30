import "server-only";

import type { CallContext, CallResult } from "@/lib/clients/connection-log";
import { haloMode } from "@/lib/clients/halo";
import { createHttpLaptopHaloClient } from "./http";
import { createMockLaptopHaloClient } from "./mock";

/** A laptop on the Halo end-of-life report. */
export type HaloEndOfLifeDevice = {
	assetId: string;
	serial: string;
	hostname: string;
	/** Null when Halo does not provide the manufacturer. */
	make?: string | null;
	model: string;
	/** YYYY-MM-DD. */
	purchaseDate: string;
	/** ISO timestamp. */
	lastSeen: string;
	/** Null when Halo has no assigned user. */
	assignedUser: { name: string; email: string } | null;
};

/**
 * A replacement device in stock. Its asset ID is the box number: Halo's
 * asset ID, such as 26620. The serial is Halo's inventory number.
 */
export type HaloStockDevice = {
	assetId: string;
	serial: string;
	hostname: string;
	model: string;
	stockLocation: string;
	stockRoom: string;
};

/** An update that writes an audit note on the device. `assetId` is the Halo asset ID. */
export type AuditedUpdate = {
	assetId: string;
	/** The colleague the case is for, such as "Ellie Ward". */
	personName: string;
	/** The case reference, such as "LR-000128". */
	reference: string;
	/** YYYY-MM-DD, London. */
	date: string;
};

export type HaloAssignedDevice = {
	assetId: string;
	/** Halo's asset type, such as "Laptop" or "Smartphone". */
	assetType: string;
	serial: string;
	hostname: string;
	model: string;
	lastSeen: string;
};

/**
 * The Halo calls laptop replacements needs, all on the one Halo connection:
 * reading devices, putting the new device In Service when a replacement is
 * completed, and decommissioning the old one. Staff details come from
 * lib/clients/halo/users.ts. Every call is logged.
 *
 * How each maps onto the Halo API (lib/clients/halo/http.ts) once the open
 * questions are answered:
 *
 *   listEndOfLifeDevices   GET /ReportData/{published report id}, or GET /Report/{id}?loadreport=true
 *   findDeviceBySerial     GET /Asset?search={serial}, then GET /Asset/{id}
 *   devicesAssignedTo      GET /Asset?user_id={Halo user id}
 *   listStock              a published report, or GET /Asset filtered by status and stock bin
 *   issueDevice            GET /Asset/{id}, then POST /Asset [{ id, status_id: In Service, … }]
 *   markOldDeviceReturned  POST /Asset [{ id, … }] (what changes is an open question)
 *   decommissionDevice     POST /Asset [{ id, … }] or another endpoint (open question)
 *
 * Halo updates with POST (an array; a record with an id is updated), never PUT.
 */
export type LaptopHaloClient = {
	/** The end-of-life report for the Import screen. */
	listEndOfLifeDevices(context: CallContext): Promise<CallResult<HaloEndOfLifeDevice[]>>;
	/** Look up one device by serial, for Add a case. */
	findDeviceBySerial(
		serial: string,
		context: CallContext,
	): Promise<CallResult<HaloEndOfLifeDevice | null>>;
	/** Every device assigned to a person, for the Import user details. */
	devicesAssignedTo(
		email: string,
		context: CallContext,
	): Promise<CallResult<HaloAssignedDevice[]>>;
	/** Replacement devices in stock. */
	listStock(context: CallContext): Promise<CallResult<HaloStockDevice[]>>;
	/**
	 * The completion update on the new device: status In Service, stock
	 * location and room cleared, Last Audit Date `date` and Audit Details
	 * "Device collected by {personName} - {reference}".
	 */
	issueDevice(device: AuditedUpdate, context: CallContext): Promise<CallResult<void>>;
	/**
	 * The old device has come back: Stock Room Room 310, Last Audit Date
	 * `date` and Audit Details "Device returned by {personName} - {reference}".
	 */
	markOldDeviceReturned(device: AuditedUpdate, context: CallContext): Promise<CallResult<void>>;
	/**
	 * Decommission the old device once every decommission check is ticked:
	 * Out of Service, Stock Location Decommissioned, Stock Room Room 310. The
	 * case is closed only when this succeeds.
	 */
	decommissionDevice(
		device: { assetId: string; serial: string | null; hostname: string | null },
		context: CallContext,
	): Promise<CallResult<void>>;
};

export const HALO_COMMENT = "Issued through the Device portal laptop replacement service";

let client: LaptopHaloClient | undefined;

export function getLaptopHaloClient(): LaptopHaloClient {
	client ??= forService(
		haloMode() === "http" ? createHttpLaptopHaloClient() : createMockLaptopHaloClient(),
	);
	return client;
}

/** Tags every call with this service, so the connection log says whose call it was. */
function forService(inner: LaptopHaloClient): LaptopHaloClient {
	return new Proxy(inner, {
		get(target, name: keyof LaptopHaloClient) {
			const method = target[name] as (...args: unknown[]) => unknown;
			return (...args: unknown[]) => {
				const context = args[args.length - 1] as CallContext;
				return method.apply(target, [
					...args.slice(0, -1),
					{ ...context, service: SERVICE },
				]);
			};
		},
	});
}

const SERVICE = "laptop_replacements";

import "server-only";

import type { CallContext, CallResult } from "@/lib/clients/connection-log";
import { haloMode } from "@/lib/clients/halo";
import { createMockLaptopHaloClient } from "./mock";

/** A laptop on the Halo end-of-life report. */
export type HaloEndOfLifeDevice = {
	assetId: string;
	serial: string;
	hostname: string;
	model: string;
	/** YYYY-MM-DD. */
	purchaseDate: string;
	/** ISO timestamp. */
	lastSeen: string;
	/** Null when Halo has no assigned user. */
	assignedUser: { name: string; email: string } | null;
};

/** A replacement device matching the Halo stock criteria. Its asset ID is the box number. */
export type HaloStockDevice = {
	assetId: string;
	serial: string;
	hostname: string;
	model: string;
	stockLocation: string;
	stockRoom: string;
};

export type HaloAssignedDevice = {
	assetId: string;
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
	 * location and room cleared, audit details and date set to today with the
	 * comment "Issued through the Device portal laptop replacement service".
	 */
	issueDevice(
		device: { assetId: string; issuedTo: string; date: string },
		context: CallContext,
	): Promise<CallResult<void>>;
	/** The old device has come back. What changes in Halo is an open question. */
	markOldDeviceReturned(
		device: { assetId: string },
		context: CallContext,
	): Promise<CallResult<void>>;
	/**
	 * Decommission the old device once every decommission check is ticked.
	 * The case is closed only when this succeeds.
	 */
	decommissionDevice(
		device: { assetId: string; serial: string | null; hostname: string | null },
		context: CallContext,
	): Promise<CallResult<void>>;
};

export const HALO_COMMENT = "Issued through the Device portal laptop replacement service";

let client: LaptopHaloClient | undefined;

export function getLaptopHaloClient(): LaptopHaloClient {
	if (haloMode() === "http") {
		throw new Error(
			"Laptop replacements' Halo calls are not built yet: the report IDs, stock criteria and status IDs are open questions.",
		);
	}
	client ??= createMockLaptopHaloClient();
	return client;
}

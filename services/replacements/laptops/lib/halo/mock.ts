import "server-only";

import { mockHaloCall } from "@/lib/clients/halo";
import { MOCK_ASSIGNED_DEVICES, MOCK_END_OF_LIFE_DEVICES, MOCK_STOCK } from "@/mocks/halo";
import type { LaptopHaloClient } from "./index";

/**
 * Halo with made-up data, logged like the real thing. Issued devices leave
 * the mock stock for the life of the server. Set MOCK_FAILURES=halo to make
 * every Halo call fail.
 */
export function createMockLaptopHaloClient(): LaptopHaloClient {
	const issued = new Set<string>();

	return {
		listEndOfLifeDevices: (context) =>
			mockHaloCall(context, () => ({
				value: MOCK_END_OF_LIFE_DEVICES,
				summary: `End-of-life report: ${MOCK_END_OF_LIFE_DEVICES.length} laptops`,
			})),

		findDeviceBySerial: (serial, context) =>
			mockHaloCall(context, () => {
				const device =
					MOCK_END_OF_LIFE_DEVICES.find((d) => d.serial === serial.trim()) ?? null;
				return {
					value: device,
					summary: device
						? `Serial lookup: found ${device.hostname}`
						: "Serial lookup: not found",
				};
			}),

		devicesAssignedTo: (email, context) =>
			mockHaloCall(context, () => {
				const devices =
					MOCK_ASSIGNED_DEVICES[email.toLowerCase()] ??
					MOCK_END_OF_LIFE_DEVICES.filter(
						(d) => d.assignedUser?.email === email.toLowerCase(),
					).map(({ assetId, serial, hostname, model, lastSeen }) => ({
						assetId,
						serial,
						hostname,
						model,
						lastSeen,
					}));
				return { value: devices, summary: `Assigned devices: ${devices.length}` };
			}),

		listStock: (context) =>
			mockHaloCall(context, () => {
				const devices = MOCK_STOCK.filter((device) => !issued.has(device.assetId));
				return { value: devices, summary: `Stock: ${devices.length} devices` };
			}),

		issueDevice: (device, context) =>
			mockHaloCall(context, () => {
				issued.add(device.assetId);
				return { value: undefined, summary: `Box ${device.assetId} In Service` };
			}),

		markOldDeviceReturned: (device, context) =>
			mockHaloCall(context, () => ({
				value: undefined,
				summary: `Asset ${device.assetId} returned`,
			})),

		decommissionDevice: (device, context) =>
			mockHaloCall(context, () => ({
				value: undefined,
				summary: `Asset ${device.assetId} decommissioned`,
			})),
	};
}

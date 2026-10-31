import { PORTAL_ROLES, type PortalRole } from "@/lib/portal/roles";

/**
 * Who can open each area (spec, "Device portal platform"): a service's team
 * role works on its cases, sessions and stock, and its admin role adds that
 * service's Settings (an admin can also do everything the team can).
 * Administrator is portal-wide: Users, portal Settings and Connections.
 */
export const ACCESS = {
	/** Any team page under /manage. */
	manage: PORTAL_ROLES,
	laptops: ["laptops_team", "laptops_admin"],
	laptopsSettings: ["laptops_admin"],
	smartphones: ["smartphones_team", "smartphones_admin"],
	newStarters: ["new_starters_team"],
	management: ["administrator"],
} as const satisfies Record<string, readonly PortalRole[]>;

export function canAccess(roles: readonly PortalRole[], allowed: readonly PortalRole[]): boolean {
	return allowed.some((role) => roles.includes(role));
}

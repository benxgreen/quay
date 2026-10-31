import { type PortalRole, ROLE_LABELS } from "@/lib/portal/roles";

type Person = { id: string; roles: readonly PortalRole[] };

/**
 * Whether the person really signed in can start impersonating `targetId`:
 * only an Administrator, not while already impersonating (`current` is
 * someone else), and never themselves.
 */
export function canImpersonate(real: Person, current: Person, targetId: string): boolean {
	return real.roles.includes("administrator") && current.id === real.id && targetId !== real.id;
}

/** "Administrator, Laptop replacements team", or "Colleague (no role)". */
export function describeRoles(roles: readonly PortalRole[]): string {
	return roles.length > 0
		? roles.map((role) => ROLE_LABELS[role]).join(", ")
		: "Colleague (no role)";
}

/** Where "Stop impersonating" goes: it ends the impersonation and returns to the user's page. */
export const STOP_IMPERSONATING_HREF = "/impersonation/stop";

/** What the impersonation banner says, or null when not impersonating. */
export function impersonationFor(user: {
	displayName: string;
	roles: readonly PortalRole[];
	impersonator: unknown;
}): { name: string; roles: string; stopHref: string } | null {
	return user.impersonator
		? {
				name: user.displayName,
				roles: describeRoles(user.roles),
				stopHref: STOP_IMPERSONATING_HREF,
			}
		: null;
}

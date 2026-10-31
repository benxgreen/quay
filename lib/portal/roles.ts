/** Portal roles, matching the CHECK on portal.user_roles (migration 0011). */
export const PORTAL_ROLES = [
	"administrator",
	"laptops_team",
	"laptops_admin",
	"smartphones_team",
	"smartphones_admin",
	"new_starters_team",
] as const;

export type PortalRole = (typeof PORTAL_ROLES)[number];

/** How each role is named on the Users pages (spec, "Users and portal Settings"). */
export const ROLE_LABELS: Record<PortalRole, string> = {
	administrator: "Administrator",
	laptops_team: "Laptop replacements team",
	laptops_admin: "Laptop replacements admin",
	smartphones_team: "Smartphone replacements team",
	smartphones_admin: "Smartphone replacements admin",
	new_starters_team: "New starters team",
};

/** The hint under each role's checkbox on a user's page (mockups: AdminUser). */
export const ROLE_DESCRIPTIONS: Record<PortalRole, string> = {
	administrator: "Portal-wide. Can change the portal's Settings, Users and Connections.",
	laptops_team:
		"Desktop Infrastructure. Can work on laptop replacement cases, sessions and stock.",
	laptops_admin: "Everything the laptop team can do, plus the service’s Settings.",
	smartphones_team:
		"Governance & Compliance. Can work on smartphone replacement cases, sessions and stock.",
	smartphones_admin: "Everything the smartphone team can do, plus the service’s Settings.",
	new_starters_team: "Can manage the new starter checklist and steps.",
};

/**
 * Tag colours on the Users pages: purple for Administrator, blue for laptop
 * replacements and green for new starters, as in the mockups. The mockups
 * show no smartphone role, so it has its own colour (turquoise).
 */
export const ROLE_TAG_COLOURS = {
	administrator: "purple",
	laptops_team: "blue",
	laptops_admin: "blue",
	smartphones_team: "turquoise",
	smartphones_admin: "turquoise",
	new_starters_team: "green",
} as const satisfies Record<PortalRole, string>;

export function isPortalRole(value: string): value is PortalRole {
	return (PORTAL_ROLES as readonly string[]).includes(value);
}

export function hasRole(roles: readonly PortalRole[], role: PortalRole): boolean {
	return roles.includes(role);
}

/** Anyone with a team, admin or administrator role sees the team pages under /manage. */
export function isTeamMember(roles: readonly PortalRole[]): boolean {
	return roles.length > 0;
}

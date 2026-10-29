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

export function hasRole(roles: readonly PortalRole[], role: PortalRole): boolean {
	return roles.includes(role);
}

/** Anyone with a team, admin or administrator role sees the team pages under /manage. */
export function isTeamMember(roles: readonly PortalRole[]): boolean {
	return roles.length > 0;
}

import { hasRole, type PortalRole } from "@/lib/portal/roles";

export type NavigationLink = { text: string; href: string };

export type MenuGroup = { title: string; links: NavigationLink[] };

export const SERVICES: NavigationLink[] = [
	{ text: "Laptop replacements", href: "/manage/replacements/laptops" },
	{ text: "Smartphone replacements", href: "/manage/replacements/smartphones" },
	{ text: "New starters", href: "/manage/new-starters" },
];

export const MANAGEMENT: NavigationLink[] = [
	{ text: "Users", href: "/manage/users" },
	{ text: "Portal settings", href: "/manage/portal-settings" },
];

/**
 * What the team header's Menu lists: every service, then Management for
 * administrators only. Whether services should be filtered by the person's
 * team roles is not decided in the spec, so all of them are shown.
 */
export function menuGroups(roles: readonly PortalRole[]): MenuGroup[] {
	const groups: MenuGroup[] = [{ title: "Services", links: SERVICES }];
	if (hasRole(roles, "administrator")) {
		groups.push({ title: "Management", links: MANAGEMENT });
	}
	return groups;
}

/** The first crumb on every team page. */
export const MANAGE_BREADCRUMB = { text: "Manage", href: "/manage" };

import { ACCESS, canAccess } from "@/lib/portal/access";
import type { PortalRole } from "@/lib/portal/roles";

export type NavigationLink = { text: string; href: string };

export type MenuGroup = { title: string; links: NavigationLink[] };

type GuardedLink = NavigationLink & { access: readonly PortalRole[] };

export const SERVICES: GuardedLink[] = [
	{ text: "Laptop replacements", href: "/manage/replacements/laptops", access: ACCESS.laptops },
	{
		text: "Smartphone replacements",
		href: "/manage/replacements/smartphones",
		access: ACCESS.smartphones,
	},
	{ text: "New starters", href: "/manage/new-starters", access: ACCESS.newStarters },
];

export const MANAGEMENT: GuardedLink[] = [
	{ text: "Users", href: "/manage/users", access: ACCESS.management },
	{ text: "Portal settings", href: "/manage/portal-settings", access: ACCESS.management },
];

/**
 * What the team header's Menu lists: the services the person can open, then
 * Management for administrators. Links they cannot open are left out
 * rather than leading to "You do not have access".
 */
export function menuGroups(roles: readonly PortalRole[]): MenuGroup[] {
	const allowed = (links: GuardedLink[]) =>
		links
			.filter((link) => canAccess(roles, link.access))
			.map(({ text, href }) => ({ text, href }));
	return [
		{ title: "Services", links: allowed(SERVICES) },
		{ title: "Management", links: allowed(MANAGEMENT) },
	].filter((group) => group.links.length > 0);
}

/** The first crumb on every team page. */
export const MANAGE_BREADCRUMB = { text: "Manage", href: "/manage" };

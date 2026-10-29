import { MANAGE_BREADCRUMB, type NavigationLink } from "@/lib/portal/navigation";

export const LAPTOPS_BASE = "/manage/replacements/laptops";

export const LAPTOPS_SERVICE_NAME = "Laptop replacements";

/** The laptop replacement service navigation, in the order the spec sets. */
export const LAPTOPS_SECTIONS = {
	bookings: { text: "Bookings", href: `${LAPTOPS_BASE}/bookings` },
	sessions: { text: "Sessions", href: `${LAPTOPS_BASE}/sessions` },
	cases: { text: "Cases", href: `${LAPTOPS_BASE}/cases` },
	stock: { text: "Stock", href: `${LAPTOPS_BASE}/stock` },
	statistics: { text: "Statistics", href: `${LAPTOPS_BASE}/statistics` },
	import: { text: "Import", href: `${LAPTOPS_BASE}/import` },
	settings: { text: "Settings", href: `${LAPTOPS_BASE}/settings` },
} satisfies Record<string, NavigationLink>;

export type LaptopsSection = keyof typeof LAPTOPS_SECTIONS;

export const LAPTOPS_NAVIGATION: NavigationLink[] = Object.values(LAPTOPS_SECTIONS);

/** Crumbs down to the service; pages add their own section and parents after these. */
export const LAPTOPS_BREADCRUMBS: NavigationLink[] = [
	MANAGE_BREADCRUMB,
	{ text: LAPTOPS_SERVICE_NAME, href: LAPTOPS_BASE },
];

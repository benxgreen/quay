import type { PortalRole } from "@/lib/portal/roles";

/** Same ids and emails as the users in db/seed/dev.sql. */
export type MockUser = {
	id: string;
	displayName: string;
	firstName: string;
	email: string;
	roles: PortalRole[];
};

/** A team member with every laptop replacement role, plus Administrator. */
export const MOCK_TEAM_USER: MockUser = {
	id: "00000000-0000-4000-8000-000000000001",
	displayName: "John Smith",
	firstName: "John",
	email: "john.smith@bcpcouncil.test",
	roles: ["administrator", "laptops_team", "laptops_admin"],
};

/** A colleague with no portal roles. */
export const MOCK_COLLEAGUE: MockUser = {
	id: "00000000-0000-4000-8000-000000000002",
	displayName: "Priya Hart",
	firstName: "Priya",
	email: "priya.hart@bcpcouncil.test",
	roles: [],
};

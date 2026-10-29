import "server-only";

import { type CallContext, type CallResult, HttpStatusError } from "@/lib/clients/connection-log";
import { callHalo, haloMode, mockHaloCall } from "@/lib/clients/halo";
import type { HaloHttp } from "@/lib/clients/halo/http";
import { MOCK_HALO_USERS } from "@/mocks/halo";

/**
 * A person in Halo. Entra ID is only for sign-in; its object ID pairs with
 * the Halo user, and every other staff detail comes from here.
 */
export type HaloUser = {
	haloUserId: number;
	/** Null when Halo has no Entra ID for them, so they cannot be matched at sign-in. */
	entraObjectId: string | null;
	email: string;
	displayName: string;
	firstName: string;
	username: string | null;
	jobTitle: string | null;
	/** Only on a single user: Halo's user list does not include it, so search results have null. */
	department: string | null;
	/** False when their account is disabled. */
	active: boolean;
	/** Their manager's name. Not read from the real API yet (see TODO.md). */
	manager: string | null;
};

export type HaloUserPage = { users: HaloUser[]; total: number };

/**
 * The staff directory, for every part of the portal: matching a signed-in
 * user, the Users page, looking someone up by email (Add a case, Import).
 * Connection: halo. A lookup is two requests, because only the single user
 * has the department: GET /Users to find them, then GET /Users/{id}.
 */
export type HaloUsersClient = {
	findByEntraObjectId(
		objectId: string,
		context: CallContext,
	): Promise<CallResult<HaloUser | null>>;
	findByEmail(email: string, context: CallContext): Promise<CallResult<HaloUser | null>>;
	/** Name, email or username contains the text. */
	search(text: string, context: CallContext): Promise<CallResult<HaloUser[]>>;
	/** One page of the directory, by name, with the total for "Showing X of Y". */
	list(
		options: { search?: string; pageNo: number; pageSize: number },
		context: CallContext,
	): Promise<CallResult<HaloUserPage>>;
	/** One person by Halo user ID, with their department. */
	get(haloUserId: number, context: CallContext): Promise<CallResult<HaloUser | null>>;
};

export function createMockHaloUsersClient(): HaloUsersClient {
	const found = (user: HaloUser | undefined) => ({
		value: user ?? null,
		summary: user ? `Staff details: found ${user.displayName}` : "Staff details: not found",
	});

	return {
		findByEntraObjectId: (objectId, context) =>
			mockHaloCall(context, () =>
				found(MOCK_HALO_USERS.find((user) => user.entraObjectId === objectId)),
			),

		findByEmail: (email, context) =>
			mockHaloCall(context, () =>
				found(MOCK_HALO_USERS.find((user) => user.email === email.trim().toLowerCase())),
			),

		search: (text, context) =>
			mockHaloCall(context, () => {
				const needle = text.trim().toLowerCase();
				const users = MOCK_HALO_USERS.filter((user) =>
					[user.displayName, user.email, user.username ?? ""].some((value) =>
						value.toLowerCase().includes(needle),
					),
				);
				return { value: users, summary: `Staff search: ${users.length} people` };
			}),

		list: ({ search = "", pageNo, pageSize }, context) =>
			mockHaloCall(context, () => {
				const needle = search.trim().toLowerCase();
				const matching = MOCK_HALO_USERS.filter((user) =>
					[user.displayName, user.email, user.username ?? ""].some((value) =>
						value.toLowerCase().includes(needle),
					),
				).sort((a, b) => a.displayName.localeCompare(b.displayName));
				const users = matching.slice((pageNo - 1) * pageSize, pageNo * pageSize);
				return {
					value: { users, total: matching.length },
					summary: `Staff list: page ${pageNo}, ${users.length} of ${matching.length}`,
				};
			}),

		get: (haloUserId, context) =>
			mockHaloCall(context, () =>
				found(MOCK_HALO_USERS.find((user) => user.haloUserId === haloUserId)),
			),
	};
}

/** The fields the portal reads from Halo's Users_List and Users records. */
type HaloApiUser = {
	id: number;
	name: string;
	firstname?: string;
	emailaddress?: string;
	login?: string;
	title?: string;
	department?: string;
	inactive?: boolean;
	azureoid?: string;
};

/**
 * Maps a Halo user to the portal's. OPEN QUESTIONS (CLAUDE.md): which Halo
 * field holds the BCP username (login is used for now) and whether `title`
 * is the job title.
 */
export function toHaloUser(user: HaloApiUser): HaloUser {
	return {
		haloUserId: user.id,
		entraObjectId: user.azureoid || null,
		email: (user.emailaddress ?? "").toLowerCase(),
		displayName: user.name,
		firstName: user.firstname || user.name.split(" ")[0],
		username: user.login || null,
		jobTitle: user.title || null,
		department: user.department || null,
		active: !user.inactive,
		manager: null,
	};
}

const LIST = { includeactive: true, includeinactive: true } as const;

async function fullUser(halo: HaloHttp, match: HaloApiUser | undefined) {
	if (!match) return { value: null, summary: "Staff details: not found" };
	const user = toHaloUser(await halo.get<HaloApiUser>(`/Users/${match.id}`));
	return { value: user, summary: `Staff details: found ${user.displayName}` };
}

export function createHttpHaloUsersClient(fetchFn?: typeof fetch): HaloUsersClient {
	return {
		findByEntraObjectId: (objectId, context) =>
			callHalo(
				context,
				async (halo) => {
					const { users } = await halo.get<{ users: HaloApiUser[] }>("/Users", {
						...LIST,
						count: 2,
						advanced_search: JSON.stringify([
							{ filter_name: "azureoid", filter_type: 2, filter_value: objectId },
						]),
					});
					// More than one match would mean Halo's data is wrong; don't guess.
					return fullUser(halo, users.length === 1 ? users[0] : undefined);
				},
				{ fetchFn },
			),

		findByEmail: (email, context) =>
			callHalo(
				context,
				async (halo) => {
					const wanted = email.trim().toLowerCase();
					const { users } = await halo.get<{ users: HaloApiUser[] }>("/Users", {
						...LIST,
						count: 10,
						search: wanted,
					});
					return fullUser(
						halo,
						users.find((user) => user.emailaddress?.toLowerCase() === wanted),
					);
				},
				{ fetchFn },
			),

		search: (text, context) =>
			callHalo(
				context,
				async (halo) => {
					const { users } = await halo.get<{ users: HaloApiUser[] }>("/Users", {
						...LIST,
						count: 50,
						search: text.trim(),
					});
					return {
						value: users.map(toHaloUser),
						summary: `Staff search: ${users.length} people`,
					};
				},
				{ fetchFn },
			),

		list: ({ search, pageNo, pageSize }, context) =>
			callHalo(
				context,
				async (halo) => {
					const page = await halo.get<{ users: HaloApiUser[]; record_count: number }>(
						"/Users",
						{
							...LIST,
							pageinate: true,
							page_no: pageNo,
							page_size: pageSize,
							order: "name",
							search: search?.trim() || undefined,
						},
					);
					return {
						value: { users: page.users.map(toHaloUser), total: page.record_count },
						summary: `Staff list: page ${pageNo}, ${page.users.length} of ${page.record_count}`,
					};
				},
				{ fetchFn },
			),

		get: (haloUserId, context) =>
			callHalo(
				context,
				async (halo) => {
					try {
						return await fullUser(halo, { id: haloUserId, name: "" });
					} catch (error) {
						if (error instanceof HttpStatusError && error.statusCode === 404) {
							return { value: null, summary: "Staff details: not found" };
						}
						throw error;
					}
				},
				{ fetchFn },
			),
	};
}

let client: HaloUsersClient | undefined;

export function getHaloUsersClient(): HaloUsersClient {
	client ??= haloMode() === "http" ? createHttpHaloUsersClient() : createMockHaloUsersClient();
	return client;
}

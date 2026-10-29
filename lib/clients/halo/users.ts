import "server-only";

import type { CallContext, CallResult } from "@/lib/clients/connection-log";
import { assertHaloMock, mockHaloCall } from "@/lib/clients/halo";
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
	department: string | null;
	/** False when their account is disabled. */
	active: boolean;
};

/**
 * The staff directory, for every part of the portal: matching a signed-in
 * user, the Users page, looking someone up by email (Add a case, Import).
 * Connection: halo.
 */
export type HaloUsersClient = {
	findByEntraObjectId(
		objectId: string,
		context: CallContext,
	): Promise<CallResult<HaloUser | null>>;
	findByEmail(email: string, context: CallContext): Promise<CallResult<HaloUser | null>>;
	/** Name, email or username contains the text. */
	search(text: string, context: CallContext): Promise<CallResult<HaloUser[]>>;
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
	};
}

let client: HaloUsersClient | undefined;

export function getHaloUsersClient(): HaloUsersClient {
	assertHaloMock();
	client ??= createMockHaloUsersClient();
	return client;
}

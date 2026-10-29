import "server-only";

import { MOCK_TEAM_USER, type MockUser } from "@/mocks/users";

export type CurrentUser = MockUser;

/**
 * STUB until stage 4 (Better Auth with Entra ID): always returns the mock
 * team user so the page frame can be built. Replace with the signed-in user
 * from the session cookie, and redirect to sign-in when there is none.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
	return MOCK_TEAM_USER;
}

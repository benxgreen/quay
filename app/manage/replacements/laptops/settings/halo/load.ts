import "server-only";

import { requireRole } from "@/lib/auth/guards";
import type { CallContext } from "@/lib/clients/connection-log";
import { ACCESS } from "@/lib/portal/access";

/** The signed-in laptops admin, and the context for the Halo reads a Halo settings page makes. */
export async function haloSettingsPage(label: string): Promise<{ context: CallContext }> {
	const user = await requireRole(ACCESS.laptopsSettings);
	return {
		context: {
			trigger: { kind: "user", label, actorUserId: user.id },
			service: "laptop_replacements",
		},
	};
}

/** A Halo read that failed, as a sentence for the page. */
export function readFailure(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

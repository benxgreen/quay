import "server-only";

import { formatWhen } from "@/lib/dates/format";
import type { UserListRow } from "@/lib/portal/users";

/** A row ready for the client table: dates already formatted on the server. */
export type UserTableRow = Omit<UserListRow, "lastSignedInAt"> & {
	id: string;
	lastSignedIn: string;
};

export function toTableRows(rows: UserListRow[]): UserTableRow[] {
	return rows.map(({ lastSignedInAt, ...row }) => ({
		...row,
		id: String(row.haloUserId ?? row.email),
		lastSignedIn: lastSignedInAt ? formatWhen(lastSignedInAt) : "Never",
	}));
}

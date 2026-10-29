"use client";

import { useState } from "react";
import { Link } from "@/components/ui/link";
import { ShowMore, useShowMoreFocus } from "@/components/ui/show-more";
import { Table, TableSecondary } from "@/components/ui/table";
import { Tag, TagGroup } from "@/components/ui/tag";
import { ROLE_LABELS, ROLE_TAG_COLOURS } from "@/lib/portal/roles";
import type { UserFilters } from "@/lib/portal/users";
import { loadMoreUsers } from "./actions";
import type { UserTableRow } from "./rows";

const COLUMNS = [
	{ key: "name", header: "Name" },
	{ key: "job", header: "Job title" },
	{ key: "roles", header: "Roles" },
	{ key: "portal", header: "Portal" },
	{ key: "signedIn", header: "Last signed in" },
];

/** The Users list with "Show more" (mockups: AdminUsers). */
export function UsersTable({
	initialRows,
	total,
	filters,
}: {
	initialRows: UserTableRow[];
	total: number;
	filters: UserFilters;
}) {
	const [rows, setRows] = useState(initialRows);
	const { containerRef, focusRow } = useShowMoreFocus<HTMLDivElement>();

	async function showMore() {
		const next = await loadMoreUsers(filters, rows.length);
		setRows((current) => [...current, ...next]);
		focusRow(next[0]?.id);
	}

	return (
		<div ref={containerRef}>
			<Table
				caption="Users"
				captionHidden
				columns={COLUMNS}
				empty="No one matches your search."
				rows={rows.map((row) => ({
					id: row.id,
					cells: {
						name: (
							<>
								{row.haloUserId ? (
									<Link href={`/manage/users/${row.haloUserId}`}>{row.name}</Link>
								) : (
									row.name
								)}
								<TableSecondary>{row.email}</TableSecondary>
							</>
						),
						job: (
							<>
								{row.jobTitle ?? "–"}
								{row.department ? (
									<TableSecondary>{row.department}</TableSecondary>
								) : null}
							</>
						),
						roles:
							row.roles.length > 0 ? (
								<TagGroup>
									{row.roles.map((role) => (
										<Tag key={role} colour={ROLE_TAG_COLOURS[role]}>
											{ROLE_LABELS[role]}
										</Tag>
									))}
								</TagGroup>
							) : row.portalUser ? (
								"Colleague"
							) : (
								"–"
							),
						portal: row.portalUser ? (
							<Tag colour="green">Portal user</Tag>
						) : (
							<Tag colour="grey">Directory only</Tag>
						),
						signedIn: row.lastSignedIn,
					},
				}))}
			/>
			<ShowMore shown={rows.length} total={total} noun="people" onShowMore={showMore} />
		</div>
	);
}

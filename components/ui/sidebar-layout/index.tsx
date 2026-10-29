import "./sidebar-layout.css";

import type { ReactNode } from "react";
import { classNames } from "@/lib/utils/class-names";

type SidebarLayoutProps = {
	/** The sidebar, usually a Sidebar. Leave it out and the main content takes the full width. */
	sidebar?: ReactNode;
	/** Which side the sidebar sits on at desktop widths. It always follows the main content on phones. */
	position?: "start" | "end";
	children: ReactNode;
};

/**
 * Main content beside a sidebar of up to 320px, such as actions on a detail
 * page (end) or filters on a list page (start). The two wrap into one
 * column when there is not room for both.
 *
 * @example
 * <SidebarLayout sidebar={<Sidebar label="Case actions">…</Sidebar>}>…</SidebarLayout>
 */
export function SidebarLayout({ sidebar, position = "end", children }: SidebarLayoutProps) {
	if (!sidebar) {
		return <>{children}</>;
	}

	return (
		<div
			className={classNames(
				"bcp-sidebar-layout",
				position === "start" && "bcp-sidebar-layout--start",
			)}
		>
			<div className="bcp-sidebar-layout-main">{children}</div>
			<div className="bcp-sidebar-layout-aside">{sidebar}</div>
		</div>
	);
}

import "./timeline.css";

import type { ReactNode } from "react";

export type TimelineItem = {
	id: string;
	/** When it happened, already formatted, such as "2 Nov 2026, 2:41pm". */
	when: ReactNode;
	/** The entry itself, such as "Email sent: invitation to user". */
	text: ReactNode;
	/** Who did it. Automated entries name the job, such as "System · Send invitations". */
	who?: ReactNode;
	/** A tag after the entry, such as a red "Failed" tag when the action's external call failed. */
	tag?: ReactNode;
};

/**
 * A list of dated entries, newest first, such as a case journal. The time
 * is on the left, the entry on the right with who did it underneath.
 *
 * @example
 * <Timeline items={[{ id: "1", when: "26 Oct 2026, 9:00am", text: "Email sent: invitation to user", who: "System · Send invitations" }]} />
 */
export function Timeline({ items }: { items: TimelineItem[] }) {
	return (
		<ol className="bcp-timeline">
			{items.map((item) => (
				<li key={item.id} className="bcp-timeline-item">
					<span className="bcp-timeline-when">{item.when}</span>
					<span>
						{item.text}
						{item.tag ? <span className="bcp-timeline-tag">{item.tag}</span> : null}
						{item.who ? <span className="bcp-timeline-who">{item.who}</span> : null}
					</span>
				</li>
			))}
		</ol>
	);
}

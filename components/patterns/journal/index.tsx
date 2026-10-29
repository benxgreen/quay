import "./journal.css";

import type { ReactNode } from "react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Timeline, type TimelineItem } from "@/components/ui/timeline";

type JournalProps = {
	heading?: ReactNode;
	headingLevel?: 2 | 3;
	/** Entries, newest first. */
	items: TimelineItem[];
	/**
	 * Where "Add a note" submits: a URL or a server action. Leave it out for a
	 * read-only journal, such as on an archived case.
	 */
	noteAction?: string | ((formData: FormData) => void | Promise<void>);
	/** Field name for the note. */
	noteName?: string;
	/** Error on the note, such as "Enter a note". */
	noteError?: string;
	/** Shown when there are no entries yet. */
	empty?: ReactNode;
};

/**
 * A record's journal: the heading, an "Add a note" form and the timeline of
 * entries, newest first, as on the case page. Every change and every email
 * is an entry; entries are never edited or deleted.
 *
 * @example
 * <Journal items={entries} noteAction={addNote} />
 */
export function Journal({
	heading = "Journal",
	headingLevel = 2,
	items,
	noteAction,
	noteName = "note",
	noteError,
	empty = "Nothing has happened on this record yet.",
}: JournalProps) {
	const Heading = `h${headingLevel}` as const;
	const headingId = useId();
	const noteId = useId();

	return (
		<section className="bcp-journal" aria-labelledby={headingId}>
			<Heading id={headingId}>{heading}</Heading>
			{noteAction ? (
				<form
					className="bcp-journal-note"
					method={typeof noteAction === "string" ? "post" : undefined}
					action={noteAction}
				>
					<Textarea
						id={noteId}
						name={noteName}
						label="Add a note"
						rows={3}
						error={noteError}
					/>
					<Button variant="secondary" type="submit">
						Add note
					</Button>
				</form>
			) : null}
			{items.length ? <Timeline items={items} /> : <p>{empty}</p>}
		</section>
	);
}

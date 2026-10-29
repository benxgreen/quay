"use client";

import "./accordion.css";

import type { ReactNode } from "react";
import { useId, useState } from "react";

export type AccordionSection = {
	id: string;
	heading: ReactNode;
	content: ReactNode;
	/** Open when the page loads. */
	open?: boolean;
};

type AccordionProps = {
	sections: AccordionSection[];
	/** Heading level of each section heading. Pick the one that fits the page outline. */
	headingLevel?: 2 | 3 | 4;
};

/**
 * Several related sections the reader may want to open one at a time, such
 * as settings groups or help topics. A "Show all sections" button opens or
 * closes every section at once. Each heading is a button with aria-expanded.
 *
 * @example
 * <Accordion sections={[{ id: "before", heading: "Before your session", content: <p>…</p> }]} />
 */
export function Accordion({ sections, headingLevel = 3 }: AccordionProps) {
	const baseId = useId();
	const [openIds, setOpenIds] = useState(
		() => new Set(sections.filter((section) => section.open).map((section) => section.id)),
	);
	const allOpen = sections.every((section) => openIds.has(section.id));
	const Heading = `h${headingLevel}` as const;

	const toggle = (id: string) =>
		setOpenIds((current) => {
			const next = new Set(current);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});

	const toggleAll = () =>
		setOpenIds(allOpen ? new Set() : new Set(sections.map((section) => section.id)));

	return (
		<div className="bcp-accordion">
			<div className="bcp-accordion-controls">
				<button
					type="button"
					className="bcp-accordion-show-all"
					aria-expanded={allOpen}
					onClick={toggleAll}
				>
					<span
						className={
							allOpen
								? "bcp-accordion-chevron"
								: "bcp-accordion-chevron bcp-accordion-chevron--down"
						}
						aria-hidden="true"
					/>
					{allOpen ? "Hide all sections" : "Show all sections"}
				</button>
			</div>
			{sections.map((section) => {
				const open = openIds.has(section.id);
				const contentId = `${baseId}-${section.id}`;

				return (
					<div key={section.id} className="bcp-accordion-section">
						<Heading className="bcp-accordion-heading">
							<button
								type="button"
								className="bcp-accordion-button"
								aria-expanded={open}
								aria-controls={contentId}
								onClick={() => toggle(section.id)}
							>
								<span className="bcp-accordion-heading-text">
									{section.heading}
								</span>
								<span className="bcp-accordion-toggle">
									<span
										className={
											open
												? "bcp-accordion-chevron"
												: "bcp-accordion-chevron bcp-accordion-chevron--down"
										}
										aria-hidden="true"
									/>
									{open ? "Hide" : "Show"}{" "}
									<span className="sr-only">this section</span>
								</span>
							</button>
						</Heading>
						<div id={contentId} className="bcp-accordion-content" hidden={!open}>
							{section.content}
						</div>
					</div>
				);
			})}
		</div>
	);
}

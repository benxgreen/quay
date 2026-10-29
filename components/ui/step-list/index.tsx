import "./step-list.css";

import type { ReactNode } from "react";

export type StepStatus = "done" | "current" | "not-started";

export type Step = {
	id: string;
	title: ReactNode;
	status: StepStatus;
	/** The step's content: a summary when done, the work when current, why it is waiting when not started. */
	content?: ReactNode;
};

const STATUS_TEXT: Record<StepStatus, string> = {
	done: "Done",
	current: "Current step",
	"not-started": "Not started",
};

/**
 * Numbered steps, based on GOV.UK step-by-step navigation: a green tick for
 * done, purple for the current step, grey for steps not started, joined by
 * a line. Every step is always open, with no show or hide. Details stay
 * above the steps; steps only record and process work.
 *
 * @example
 * <StepList steps={[{ id: "device", title: "Replacement device", status: "done", content: <p>Box 45855 is allocated.</p> }]} />
 */
export function StepList({ steps, headingLevel = 3 }: { steps: Step[]; headingLevel?: 2 | 3 | 4 }) {
	const Heading = `h${headingLevel}` as const;

	return (
		<ol className="bcp-step-list">
			{steps.map((step, index) => (
				<li
					key={step.id}
					className={`bcp-step-list-step bcp-step-list-step--${step.status}`}
				>
					<span className="bcp-step-list-number" aria-hidden="true">
						{step.status === "done" ? (
							<svg
								width="18"
								height="18"
								viewBox="0 0 20 20"
								aria-hidden="true"
								focusable="false"
							>
								<path
									d="M4 10.5l4 4 8-9"
									fill="none"
									stroke="currentColor"
									strokeWidth="3"
								/>
							</svg>
						) : (
							index + 1
						)}
					</span>
					<Heading className="bcp-step-list-heading">
						<span className="bcp-step-list-title">
							<span className="sr-only">Step {index + 1}:</span> {step.title}
						</span>{" "}
						<span className="bcp-step-list-status">{STATUS_TEXT[step.status]}</span>
					</Heading>
					{step.content ? (
						<div className="bcp-step-list-content">{step.content}</div>
					) : null}
				</li>
			))}
		</ol>
	);
}

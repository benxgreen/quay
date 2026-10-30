import type { ReactNode } from "react";
import { type RadioItem, Radios } from "@/components/ui/radios";
import { formatLongDate, formatTime } from "@/lib/dates/format";
import type { IsoDate } from "@/lib/dates/working-days";

export type SessionOption = {
	id: string;
	date: IsoDate;
	time: string;
	location: string;
	placesLeft: number;
};

type SessionChoiceProps = {
	weeks: { weekStarting: IsoDate; sessions: SessionOption[] }[];
	name?: string;
	legend: ReactNode;
	caption?: ReactNode;
	hint?: ReactNode;
	error?: string;
	value?: string;
	/** Ids shown as Full whatever their places, such as one that just filled. */
	full?: string[];
	/** Options after the dates, such as "or" and "I am not available for any of these dates". */
	after?: RadioItem[];
};

/**
 * Dates to book, grouped by week, each with its time, location and places
 * left (mockups: UserChooseDate). A full session stays listed as Full and
 * can't be chosen.
 */
export function SessionChoice({
	weeks,
	name = "session",
	legend,
	caption,
	hint,
	error,
	value,
	full = [],
	after = [],
}: SessionChoiceProps) {
	const items: RadioItem[] = weeks.flatMap((week) => [
		{
			heading: `Week starting ${formatLongDate(week.weekStarting, { year: true }).replace(/^\w+ /, "")}`,
		},
		...week.sessions.map((session) => {
			const isFull = session.placesLeft <= 0 || full.includes(session.id);
			return {
				value: session.id,
				label: `${formatLongDate(session.date)}, ${formatTime(session.time)}`,
				hint: `${session.location} · ${isFull ? "Full" : `${session.placesLeft} ${session.placesLeft === 1 ? "place" : "places"} left`}`,
				disabled: isFull,
			};
		}),
	]);

	return (
		<Radios
			name={name}
			legend={legend}
			caption={caption}
			isPageHeading
			legendSize="l"
			hint={hint}
			error={error}
			value={value}
			items={[...items, ...after]}
		/>
	);
}

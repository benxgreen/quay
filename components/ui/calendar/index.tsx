import "./calendar.css";

import NextLink from "next/link";
import type { ReactNode } from "react";
import { classNames } from "@/lib/utils/class-names";

export type CalendarDay = {
	/** A key for the day, usually YYYY-MM-DD. */
	key: string;
	/** The day of the month, such as "11". */
	number: string;
	/** The whole date for screen readers and phones, such as "Wednesday 11 November". */
	label: string;
	/** False for days from the month before or after, which are left blank. */
	inPeriod: boolean;
	/** Days already gone are greyed. */
	past?: boolean;
	children?: ReactNode;
};

type CalendarProps = {
	/** Names the table, such as "Sessions in November 2026". */
	caption: string;
	/** Column headings, such as Monday to Friday. */
	weekdays: { short: string; long: string }[];
	/** One array per week, one day per weekday column. */
	weeks: CalendarDay[][];
};

/**
 * A month as a grid of weeks, one column per weekday, with entries in each
 * day such as sessions. It is a table, so screen readers announce the
 * weekday with each day. On phones the days stack, each with its full date.
 *
 * @example
 * <Calendar caption="Sessions in November 2026" weekdays={WEEKDAYS} weeks={weeks} />
 */
export function Calendar({ caption, weekdays, weeks }: CalendarProps) {
	return (
		<table className="bcp-calendar">
			<caption className="sr-only">{caption}</caption>
			<thead>
				<tr>
					{weekdays.map((weekday) => (
						<th
							key={weekday.long}
							scope="col"
							abbr={weekday.long}
							className="bcp-calendar-weekday"
						>
							{weekday.short}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{weeks.map((week) => (
					<tr key={week[0]?.key}>
						{week.map((day) =>
							day.inPeriod ? (
								<td
									key={day.key}
									className={classNames(
										"bcp-calendar-day",
										day.past && "bcp-calendar-day--past",
									)}
								>
									<span className="bcp-calendar-number" aria-hidden="true">
										{day.number}
									</span>
									<span className="bcp-calendar-label">{day.label}</span>
									{day.children}
								</td>
							) : (
								<td
									key={day.key}
									className="bcp-calendar-day bcp-calendar-day--outside"
								/>
							),
						)}
					</tr>
				))}
			</tbody>
		</table>
	);
}

type CalendarEntryProps = {
	href: string;
	/** Such as "10:00am Collection". */
	title: string;
	/** Such as "7 of 10" or "Cancelled". */
	detail: string;
	/** Matches the type tags: light blue for Collection, purple for Session. */
	colour: "light-blue" | "purple";
	/** Struck through and grey, such as a cancelled session. */
	struck?: boolean;
};

/** One entry in a calendar day, linking to its detail. */
export function CalendarEntry({ href, title, detail, colour, struck }: CalendarEntryProps) {
	return (
		<NextLink
			href={href}
			className={classNames(
				"bcp-calendar-entry",
				`bcp-calendar-entry--${colour}`,
				struck && "bcp-calendar-entry--struck",
			)}
		>
			<span className="bcp-calendar-entry-title">{title}</span>
			<span className="bcp-calendar-entry-detail">{detail}</span>
		</NextLink>
	);
}

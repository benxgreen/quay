"use client";

import { useActionState } from "react";
import { Button, ButtonGroup } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { ErrorSummary } from "@/components/ui/error-summary";
import { Link } from "@/components/ui/link";
import { TextInput } from "@/components/ui/text-input";
import { Textarea } from "@/components/ui/textarea";
import { TimeInput } from "@/components/ui/time-input";
import { type CustomState, teamCustomAppointment } from "../../booking-actions";

/** Mockups: AdminActCustomBooking. */
export function CustomForm({
	reference,
	location,
	time,
	cancelHref,
}: {
	reference: string;
	location: string;
	time: string;
	cancelHref: string;
}) {
	const [state, action] = useActionState<CustomState, FormData>(
		teamCustomAppointment.bind(null, reference),
		{},
	);
	const v = state.values;
	const e = state.errors ?? {};
	const [hour, minute] = time.split(":");
	const ids: Record<string, string> = {
		date: "date-day",
		time: "time-hour",
		location: "location",
	};
	const summary = Object.entries(e).map(([field, text]) => ({
		fieldId: ids[field] ?? field,
		text,
	}));

	return (
		<form action={action}>
			<ErrorSummary errors={summary} />
			<DateInput
				name="date"
				legend="Date"
				legendSize="m"
				hint="For example, 14 11 2026"
				error={e.date}
				value={{ day: v?.day, month: v?.month, year: v?.year }}
			/>
			<TimeInput
				name="time"
				legend="Start time"
				legendSize="m"
				hint="Use the 24-hour clock, for example 14 30"
				error={e.time}
				value={{ hour: v?.hour ?? hour, minute: v?.minute ?? minute }}
			/>
			<TextInput
				id="location"
				name="location"
				label="Location"
				labelSize="m"
				hint="Filled in from the defaults. Change it if you have agreed somewhere else."
				error={e.location}
				defaultValue={v?.location ?? location}
			/>
			<Textarea
				id="note"
				name="note"
				label="Note for the confirmation email (optional)"
				defaultValue={v?.note}
				rows={2}
			/>
			<ButtonGroup>
				<Button type="submit">Book appointment</Button>
				<Link href={cancelHref}>Go back</Link>
			</ButtonGroup>
		</form>
	);
}

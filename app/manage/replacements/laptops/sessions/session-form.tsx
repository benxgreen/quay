"use client";

import { useActionState, useState } from "react";
import type { ReplacementType } from "@/components/service/replacements/type-tag";
import { Button, ButtonGroup } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { ErrorSummary } from "@/components/ui/error-summary";
import { InsetText } from "@/components/ui/inset-text";
import { Link } from "@/components/ui/link";
import { Radios } from "@/components/ui/radios";
import { TextInput } from "@/components/ui/text-input";
import { TimeInput } from "@/components/ui/time-input";
import type { SessionFormValues } from "@/services/replacements/laptops/lib/session-form";
import { type SessionFormState, saveSession } from "./actions";

type Defaults = Record<ReplacementType, { time: string; capacity: number; location: string }>;

type SessionFormProps = {
	/** Null when adding. */
	sessionId: string | null;
	defaults: Defaults;
	/** The saved session's values, when editing. */
	initial?: SessionFormValues;
	/** People booked, when editing: the type can't change while there are any. */
	booked?: number;
	cancelHref: string;
};

const TYPE_LABELS: Record<ReplacementType, string> = {
	collection: "Collection",
	session: "Session",
};

const EMPTY: SessionFormValues = {
	type: "",
	day: "",
	month: "",
	year: "",
	hour: "",
	minute: "",
	capacity: "",
	location: "",
};

function fromDefaults(values: SessionFormValues, type: ReplacementType, defaults: Defaults) {
	const [hour, minute] = defaults[type].time.split(":");
	return {
		...values,
		type,
		hour,
		minute,
		capacity: String(defaults[type].capacity),
		location: defaults[type].location,
	};
}

/**
 * Add or edit a session (mockups: AdminAddSession). The type is asked first;
 * choosing it fills in that type's start time, capacity and location from
 * Settings, which stay editable.
 */
export function SessionForm({
	sessionId,
	defaults,
	initial,
	booked = 0,
	cancelHref,
}: SessionFormProps) {
	const [state, action, pending] = useActionState<SessionFormState, FormData>(
		saveSession.bind(null, sessionId),
		{},
	);
	const [chosen, setChosen] = useState<{
		values: SessionFormValues;
		filledFrom: ReplacementType | null;
	}>({ values: initial ?? EMPTY, filledFrom: null });
	// After a failed save, show what was sent back, not the earlier choice.
	const values = state.values ?? chosen.values;
	const errors = state.errors ?? {};
	const typeLocked = booked > 0;

	function chooseType(type: string) {
		if (type !== "collection" && type !== "session") return;
		setChosen({ values: fromDefaults(values, type, defaults), filledFrom: type });
	}

	const summary = [
		errors.type && { fieldId: "type", text: errors.type },
		errors.date && { fieldId: `date-${errors.dateParts?.[0] ?? "day"}`, text: errors.date },
		errors.time && { fieldId: `time-${errors.timeParts?.[0] ?? "hour"}`, text: errors.time },
		errors.capacity && { fieldId: "capacity", text: errors.capacity },
		errors.location && { fieldId: "location", text: errors.location },
	].filter((item): item is { fieldId: string; text: string } => Boolean(item));

	// Remount the fields when the type pre-fills them, so they show the new values.
	const fieldsKey = `${chosen.filledFrom ?? "initial"}-${state.values ? JSON.stringify(state.values) : ""}`;

	return (
		<form
			action={action}
			onChange={(event) => {
				const target = event.target;
				if (target instanceof HTMLInputElement && target.name === "type" && !state.values) {
					chooseType(target.value);
				}
			}}
			noValidate
		>
			<ErrorSummary errors={summary} />
			{typeLocked ? <input type="hidden" name="type" value={values.type} /> : null}
			<Radios
				name="type"
				legend="Type"
				legendSize="m"
				hint={
					typeLocked
						? "The type can’t be changed while people are booked on this session."
						: undefined
				}
				error={errors.type}
				value={values.type}
				items={[
					{
						value: "collection",
						label: "Collection",
						hint: "Colleagues pick up a laptop that is already set up",
						disabled: typeLocked,
					},
					{
						value: "session",
						label: "Session",
						hint: "An engineer sets up the laptop with the colleague",
						disabled: typeLocked,
					},
				]}
			/>
			{chosen.filledFrom && !sessionId ? (
				<InsetText>
					Time, capacity and location have been filled in from the{" "}
					{TYPE_LABELS[chosen.filledFrom]} defaults. You can change them for this session.
				</InsetText>
			) : null}
			<div key={fieldsKey}>
				<DateInput
					name="date"
					legend="Date"
					legendSize="m"
					hint="For example, 12 11 2026"
					error={errors.date}
					errorParts={errors.dateParts}
					value={{ day: values.day, month: values.month, year: values.year }}
				/>
				<TimeInput
					name="time"
					legend="Start time"
					legendSize="m"
					hint="Use the 24-hour clock, for example 14 30"
					error={errors.time}
					errorParts={errors.timeParts}
					value={{ hour: values.hour, minute: values.minute }}
				/>
				<TextInput
					id="capacity"
					name="capacity"
					label="Capacity"
					labelSize="m"
					hint="Most people who can book this session"
					inputMode="numeric"
					width="3"
					error={errors.capacity}
					defaultValue={values.capacity}
				/>
				<TextInput
					id="location"
					name="location"
					label="Location"
					labelSize="m"
					error={errors.location}
					defaultValue={values.location}
				/>
			</div>
			<ButtonGroup>
				<Button type="submit" aria-disabled={pending || undefined}>
					Save session
				</Button>
				<Link href={cancelHref}>Cancel</Link>
			</ButtonGroup>
		</form>
	);
}

"use client";

import {
	FormErrors,
	SaveOrCancel,
	type SettingsAction,
	useSettingsForm,
} from "@/components/patterns/settings-form";
import { Checkboxes } from "@/components/ui/checkboxes";
import { InsetText } from "@/components/ui/inset-text";
import { Radios } from "@/components/ui/radios";
import { TextInput } from "@/components/ui/text-input";
import { Textarea } from "@/components/ui/textarea";
import { TimeInput } from "@/components/ui/time-input";
import { WORKING_WEEKDAYS } from "@/lib/dates/working-days";

/** Laptop replacement settings forms; the generic ones are in components/patterns/settings-form. */

const WEEKDAY_ITEMS = WORKING_WEEKDAYS.map((label, index) => ({ value: String(index + 1), label }));

/** The error summary, linking each error to its field (`ids` maps an error to a field id). */
/**
 * The "Add" form under a list on the Settings page, such as "Add software".
 * Errors show on the field rather than in a summary, because the form sits
 * in the middle of a long page.
 */
export function SoftwareForm({
	action,
	initial,
	cancelHref,
}: {
	action: SettingsAction;
	initial: { name: string; hint: string };
	cancelHref: string;
}) {
	const [state, formAction, pending] = useSettingsForm(action, initial);
	const { values, errors } = state;
	return (
		<form action={formAction} key={JSON.stringify(values)}>
			<FormErrors errors={errors} />
			<TextInput
				id="name"
				name="name"
				label="Name"
				defaultValue={values.name}
				error={errors.name}
			/>
			<TextInput
				id="hint"
				name="hint"
				label="Hint (optional)"
				hint="Shown to colleagues under the checkbox, for example what the software is for and whether it needs a licence."
				defaultValue={values.hint}
				error={errors.hint}
			/>
			<SaveOrCancel cancelHref={cancelHref} pending={pending} />
		</form>
	);
}

export function FaqForm({
	action,
	initial,
	cancelHref,
	saveLabel,
}: {
	action: SettingsAction;
	initial: { question: string; answer: string; shownFor: string };
	cancelHref: string;
	saveLabel: string;
}) {
	const [state, formAction, pending] = useSettingsForm(action, initial);
	const { values, errors } = state;
	return (
		<form action={formAction} key={JSON.stringify(values)}>
			<FormErrors errors={errors} />
			<TextInput
				id="question"
				name="question"
				label="Question"
				defaultValue={values.question}
				error={errors.question}
			/>
			<Textarea
				id="answer"
				name="answer"
				label="Answer"
				hint="You can use paragraphs, bullet points and links."
				rows={6}
				defaultValue={values.answer}
				error={errors.answer}
			/>
			<Checkboxes
				name="shownFor"
				legend="Show for"
				legendSize="m"
				hint="Only shown to colleagues booked onto these types. You can add the same question again with a different answer for the other type."
				error={errors.shownFor}
				values={values.shownFor ? values.shownFor.split(",") : []}
				items={[
					{ value: "session", label: "Session" },
					{ value: "collection", label: "Collection" },
				]}
			/>
			<SaveOrCancel cancelHref={cancelHref} pending={pending} label={saveLabel} />
		</form>
	);
}

/** Mockups: AdminMainContent. Markdown with a Preview button that renders it under the form. */
export function DefaultsForm({
	action,
	initial,
	cancelHref,
}: {
	action: SettingsAction;
	initial: Record<string, string>;
	cancelHref: string;
}) {
	const [state, formAction, pending] = useSettingsForm(action, initial);
	const { values, errors } = state;
	return (
		<form action={formAction} key={JSON.stringify(values)}>
			<FormErrors errors={errors} ids={{ time: "time-hour" }} />
			<TimeInput
				name="time"
				legend="Start time"
				legendSize="m"
				hint="Use the 24-hour clock, for example 10 00"
				error={errors.time}
				value={{ hour: values["time-hour"], minute: values["time-minute"] }}
			/>
			<TextInput
				id="capacity"
				name="capacity"
				label="Capacity"
				labelSize="m"
				width="3"
				inputMode="numeric"
				defaultValue={values.capacity}
				error={errors.capacity}
			/>
			<TextInput
				id="location"
				name="location"
				label="Location"
				labelSize="m"
				defaultValue={values.location}
				error={errors.location}
			/>
			<SaveOrCancel cancelHref={cancelHref} pending={pending} />
		</form>
	);
}

/** Mockups: AdminSettingNumber. One number with words after it. */
/** Mockups: AdminSettingReminder. */
export function ReminderForm({
	action,
	initial,
	cancelHref,
	example,
}: {
	action: SettingsAction;
	initial: { days: string; weekday: string };
	cancelHref: string;
	example: string;
}) {
	const [state, formAction, pending] = useSettingsForm(action, initial);
	const { values, errors } = state;
	return (
		<form action={formAction} key={JSON.stringify(values)}>
			<FormErrors errors={errors} />
			<TextInput
				id="days"
				name="days"
				label="Send the first reminder"
				width="3"
				inputMode="numeric"
				defaultValue={values.days}
				error={errors.days}
				suffix="days after the invitation"
			/>
			<Radios
				name="weekday"
				legend="Then send a reminder every week on"
				legendSize="s"
				error={errors.weekday}
				value={values.weekday}
				items={WEEKDAY_ITEMS}
			/>
			<InsetText>
				<p>{example}</p>
			</InsetText>
			<SaveOrCancel cancelHref={cancelHref} pending={pending} />
		</form>
	);
}

/** Mockups: AdminSettingReturn. */
export function ReturnRemindersForm({
	action,
	initial,
	cancelHref,
}: {
	action: SettingsAction;
	initial: { enabled: string; weekday: string };
	cancelHref: string;
}) {
	const [state, formAction, pending] = useSettingsForm(action, initial);
	const { values, errors } = state;
	return (
		<form action={formAction} key={JSON.stringify(values)}>
			<FormErrors errors={errors} />
			<Radios
				name="enabled"
				legend="Send return reminders"
				legendSize="s"
				error={errors.enabled}
				value={values.enabled}
				items={[
					{ value: "yes", label: "Yes" },
					{ value: "no", label: "No, turn them off for everyone" },
				]}
			/>
			<Radios
				name="weekday"
				legend="Send them every week on"
				legendSize="s"
				error={errors.weekday}
				value={values.weekday}
				items={WEEKDAY_ITEMS}
			/>
			<InsetText>
				<p>
					Reminders stop when the old device is marked as returned. They can also be
					turned off on a single case.
				</p>
			</InsetText>
			<SaveOrCancel cancelHref={cancelHref} pending={pending} />
		</form>
	);
}

export function CheckForm({
	action,
	initial,
	cancelHref,
}: {
	action: SettingsAction;
	initial: { label: string };
	cancelHref: string;
}) {
	const [state, formAction, pending] = useSettingsForm(action, initial);
	const { values, errors } = state;
	return (
		<form action={formAction} key={JSON.stringify(values)}>
			<FormErrors errors={errors} />
			<TextInput
				id="label"
				name="label"
				label="Check"
				defaultValue={values.label}
				error={errors.label}
			/>
			<SaveOrCancel cancelHref={cancelHref} pending={pending} />
		</form>
	);
}

/** One value whose label is the page heading, such as the team name or a connection's link. */

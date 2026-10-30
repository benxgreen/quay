"use client";

import { type ReactNode, useActionState } from "react";
import { InlineForm } from "@/components/patterns/inline-form";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Checkboxes } from "@/components/ui/checkboxes";
import { ErrorSummary } from "@/components/ui/error-summary";
import { InsetText } from "@/components/ui/inset-text";
import { Link } from "@/components/ui/link";
import { MarkdownText } from "@/components/ui/markdown";
import { Preview } from "@/components/ui/preview";
import { Radios } from "@/components/ui/radios";
import { TextInput } from "@/components/ui/text-input";
import { Textarea } from "@/components/ui/textarea";
import { TimeInput } from "@/components/ui/time-input";
import type { SettingsFormState } from "./actions";

type Action = (state: SettingsFormState, formData: FormData) => Promise<SettingsFormState>;

const WEEKDAY_ITEMS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map(
	(label, index) => ({ value: String(index + 1), label }),
);

/** The error summary, linking each error to its field (`ids` maps an error to a field id). */
function Summary({
	errors,
	ids = {},
}: {
	errors: Record<string, string>;
	ids?: Record<string, string>;
}) {
	return (
		<ErrorSummary
			errors={Object.entries(errors).map(([field, text]) => ({
				fieldId: ids[field] ?? field,
				text,
			}))}
		/>
	);
}

function SaveOrCancel({
	cancelHref,
	pending,
	label = "Save",
	children,
}: {
	cancelHref: string;
	pending: boolean;
	label?: string;
	children?: ReactNode;
}) {
	return (
		<ButtonGroup>
			<Button type="submit" aria-disabled={pending || undefined}>
				{label}
			</Button>
			{children}
			<Link href={cancelHref}>Cancel</Link>
		</ButtonGroup>
	);
}

function useSettingsForm(action: Action, initial: Record<string, string>) {
	return useActionState(action, { values: initial, errors: {} });
}

/**
 * The "Add" form under a list on the Settings page, such as "Add software".
 * Errors show on the field rather than in a summary, because the form sits
 * in the middle of a long page.
 */
export function InlineAddForm({
	action,
	fields,
	button = "Add",
}: {
	action: Action;
	fields: { name: string; label: string; width?: "20" | "30" }[];
	button?: string;
}) {
	const [state, formAction, pending] = useSettingsForm(
		action,
		Object.fromEntries(fields.map((field) => [field.name, ""])),
	);
	return (
		<form action={formAction} key={JSON.stringify(state.values)}>
			<InlineForm>
				{fields.map((field) => (
					<TextInput
						key={field.name}
						id={`add-${field.name}-${button}`}
						name={field.name}
						label={field.label}
						width={field.width ?? "20"}
						defaultValue={state.values[field.name]}
						error={state.errors[field.name]}
					/>
				))}
				<Button type="submit" aria-disabled={pending || undefined}>
					{button}
				</Button>
			</InlineForm>
		</form>
	);
}

export function SoftwareForm({
	action,
	initial,
	cancelHref,
}: {
	action: Action;
	initial: { name: string; hint: string };
	cancelHref: string;
}) {
	const [state, formAction, pending] = useSettingsForm(action, initial);
	const { values, errors } = state;
	return (
		<form action={formAction} key={JSON.stringify(values)}>
			<Summary errors={errors} />
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
	action: Action;
	initial: { question: string; answer: string; shownFor: string };
	cancelHref: string;
	saveLabel: string;
}) {
	const [state, formAction, pending] = useSettingsForm(action, initial);
	const { values, errors } = state;
	return (
		<form action={formAction} key={JSON.stringify(values)}>
			<Summary errors={errors} />
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
export function ContentForm({
	action,
	initial,
	cancelHref,
}: {
	action: Action;
	initial: { body: string };
	cancelHref: string;
}) {
	const [state, formAction, pending] = useSettingsForm(action, initial);
	const { values, errors } = state;
	return (
		<>
			<form action={formAction} key={JSON.stringify(values)}>
				<Summary errors={errors} />
				<Textarea
					id="body"
					name="body"
					label="Content"
					hint="Use Markdown: ## for headings, - for bullet points, **text** for bold and [text](link) for links. {username}, {date} and {location} are replaced with the colleague's details."
					rows={19}
					monospace
					defaultValue={values.body}
					error={errors.body}
				/>
				<SaveOrCancel cancelHref={cancelHref} pending={pending}>
					<Button type="submit" name="intent" value="preview" variant="secondary">
						Preview
					</Button>
				</SaveOrCancel>
			</form>
			{state.preview ? (
				<section aria-labelledby="preview-heading">
					<h2 id="preview-heading">Preview</h2>
					<InsetText>
						<p>
							Not saved yet. The colleague's details are filled in when they see the
							page.
						</p>
					</InsetText>
					<Preview label="Preview of the page content">
						<MarkdownText markdown={values.body} />
					</Preview>
				</section>
			) : null}
		</>
	);
}

export function DefaultsForm({
	action,
	initial,
	cancelHref,
}: {
	action: Action;
	initial: Record<string, string>;
	cancelHref: string;
}) {
	const [state, formAction, pending] = useSettingsForm(action, initial);
	const { values, errors } = state;
	return (
		<form action={formAction} key={JSON.stringify(values)}>
			<Summary errors={errors} ids={{ time: "time-hour" }} />
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
export function NumberForm({
	action,
	initial,
	title,
	caption,
	hint,
	suffix,
	inset,
	cancelHref,
}: {
	action: Action;
	initial: { value: string };
	title: string;
	caption: string;
	hint: string;
	suffix: string;
	inset: string;
	cancelHref: string;
}) {
	const [state, formAction, pending] = useSettingsForm(action, initial);
	const { values, errors } = state;
	return (
		<form action={formAction} key={JSON.stringify(values)}>
			<Summary errors={errors} />
			<TextInput
				id="value"
				name="value"
				label={title}
				caption={caption}
				labelSize="l"
				isPageHeading
				hint={hint}
				width="3"
				inputMode="numeric"
				defaultValue={values.value}
				error={errors.value}
				suffix={suffix}
			/>
			<InsetText>
				<p>{inset}</p>
			</InsetText>
			<SaveOrCancel cancelHref={cancelHref} pending={pending} />
		</form>
	);
}

/** Mockups: AdminSettingReminder. */
export function ReminderForm({
	action,
	initial,
	cancelHref,
	example,
}: {
	action: Action;
	initial: { days: string; weekday: string };
	cancelHref: string;
	example: string;
}) {
	const [state, formAction, pending] = useSettingsForm(action, initial);
	const { values, errors } = state;
	return (
		<form action={formAction} key={JSON.stringify(values)}>
			<Summary errors={errors} />
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
	action: Action;
	initial: { enabled: string; weekday: string };
	cancelHref: string;
}) {
	const [state, formAction, pending] = useSettingsForm(action, initial);
	const { values, errors } = state;
	return (
		<form action={formAction} key={JSON.stringify(values)}>
			<Summary errors={errors} />
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
	action: Action;
	initial: { label: string };
	cancelHref: string;
}) {
	const [state, formAction, pending] = useSettingsForm(action, initial);
	const { values, errors } = state;
	return (
		<form action={formAction} key={JSON.stringify(values)}>
			<Summary errors={errors} />
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
export function ValueForm({
	action,
	initial,
	title,
	caption,
	hint,
	type = "text",
	autoComplete,
	cancelHref,
}: {
	action: Action;
	initial: { value: string };
	title: string;
	caption: string;
	hint?: ReactNode;
	type?: "text" | "email" | "url";
	autoComplete?: string;
	cancelHref: string;
}) {
	const [state, formAction, pending] = useSettingsForm(action, initial);
	const { values, errors } = state;
	return (
		<form action={formAction} key={JSON.stringify(values)}>
			<Summary errors={errors} />
			<TextInput
				id="value"
				name="value"
				label={title}
				caption={caption}
				labelSize="l"
				isPageHeading
				hint={hint}
				type={type}
				autoComplete={autoComplete}
				spellCheck={false}
				defaultValue={values.value}
				error={errors.value}
			/>
			<SaveOrCancel cancelHref={cancelHref} pending={pending} />
		</form>
	);
}

"use client";

import "./settings-form.css";

import { type ReactNode, useActionState, useId } from "react";
import { InlineForm } from "@/components/patterns/inline-form";
import { Button, ButtonGroup } from "@/components/ui/button";
import { ErrorSummary } from "@/components/ui/error-summary";
import { InsetText } from "@/components/ui/inset-text";
import { Link } from "@/components/ui/link";
import { MarkdownText } from "@/components/ui/markdown";
import { Preview } from "@/components/ui/preview";
import { TextInput } from "@/components/ui/text-input";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/forms/state";

/**
 * Forms any service's settings can use, each posting to a server action
 * that returns FormState: an "Add" row under a list, one value whose label
 * is the page heading, a number with its unit, and Markdown with a preview.
 * FormErrors, SaveOrCancel and useSettingsForm build the rest.
 */

export type SettingsAction = (state: FormState, formData: FormData) => Promise<FormState>;

export function FormErrors({
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

export function SaveOrCancel({
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

export function useSettingsForm(action: SettingsAction, initial: Record<string, string>) {
	return useActionState(action, { values: initial, errors: {} });
}

export function InlineAddForm({
	action,
	fields,
	button = "Add",
}: {
	action: SettingsAction;
	fields: { name: string; label: string; width?: "20" | "30" }[];
	button?: string;
}) {
	// Unique on the page, which can have several Add rows (one per checklist).
	const idBase = useId();
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
						id={`${idBase}-${field.name}`}
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

export function MarkdownForm({
	action,
	initial,
	cancelHref,
}: {
	action: SettingsAction;
	initial: { body: string };
	cancelHref: string;
}) {
	const [state, formAction, pending] = useSettingsForm(action, initial);
	const { values, errors } = state;
	return (
		<>
			<form action={formAction} key={JSON.stringify(values)}>
				<FormErrors errors={errors} />
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
	action: SettingsAction;
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
			<FormErrors errors={errors} />
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
	action: SettingsAction;
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
			<FormErrors errors={errors} />
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

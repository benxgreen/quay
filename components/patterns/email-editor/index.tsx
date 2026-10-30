"use client";

import "./email-editor.css";

import { useActionState, useState } from "react";
import { Editor, EditorCode, EditorFrame } from "@/components/patterns/editor";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Details } from "@/components/ui/details";
import { ErrorSummary } from "@/components/ui/error-summary";
import { Link } from "@/components/ui/link";
import { NotificationBanner } from "@/components/ui/notification-banner";
import { Preview } from "@/components/ui/preview";
import { Table } from "@/components/ui/table";
import { TextInput } from "@/components/ui/text-input";
import { Textarea } from "@/components/ui/textarea";
import { renderEmail } from "@/lib/emails/render";
import { PREHEADER_MAX } from "@/lib/emails/validate";
import type { FormState } from "@/lib/forms/state";

type Variable = { name: string; description: string; example: string };

type EmailEditorProps = {
	action: (state: FormState, formData: FormData) => Promise<FormState>;
	initial: { subject: string; preheader: string; body: string };
	variables: Variable[];
	/** Filled into the preview: the variables' examples and the team name. */
	examples: Record<string, string>;
	layoutHtml: string;
	sender: { teamName: string; sentFrom: string };
	exampleTo: string;
	cancelHref: string;
};

/**
 * Mockups: AdminEmailEdit. Any service's email on the left and, on the
 * right, a preview in the portal email template with example details that
 * updates as you type. The service passes its variables, their example
 * values and an action that saves, or sends a test when intent is "test".
 */
export function EmailEditor({
	action,
	initial,
	variables,
	examples,
	layoutHtml,
	sender,
	exampleTo,
	cancelHref,
}: EmailEditorProps) {
	const [state, formAction, pending] = useActionState(action, { values: initial, errors: {} });
	const [draft, setDraft] = useState(initial);
	const { errors } = state;

	const rendered = renderEmail({
		template: { subject: draft.subject, preheader: draft.preheader, bodyMarkdown: draft.body },
		layoutHtml,
		teamName: sender.teamName,
		values: examples,
		mode: "send",
	});
	const update = (name: keyof typeof draft) => (event: { target: { value: string } }) =>
		setDraft((current) => ({ ...current, [name]: event.target.value }));

	return (
		<Editor>
			<form action={formAction}>
				<ErrorSummary
					errors={Object.entries(errors).map(([fieldId, text]) => ({ fieldId, text }))}
				/>
				{state.test ? (
					<NotificationBanner
						variant={state.test.ok ? "success" : "failed"}
						heading={state.test.ok ? "Test sent" : "Test not sent"}
					>
						<p>{state.test.message}</p>
					</NotificationBanner>
				) : null}
				<TextInput
					id="subject"
					name="subject"
					label="Subject"
					hint="You can use variables."
					value={draft.subject}
					onChange={update("subject")}
					error={errors.subject}
				/>
				<TextInput
					id="preheader"
					name="preheader"
					label="Preheader"
					hint={
						<>
							The short summary most inboxes show after the subject. It is not shown
							in the email itself. You can use variables. {draft.preheader.length} of{" "}
							{PREHEADER_MAX} characters.
						</>
					}
					value={draft.preheader}
					onChange={update("preheader")}
					error={errors.preheader}
				/>
				<Details summary="Available variables">
					<Table
						caption="Variables"
						captionHidden
						columns={[
							{ key: "variable", header: "Variable" },
							{ key: "description", header: "Replaced with" },
							{ key: "example", header: "Example" },
						]}
						rows={variables.map((variable) => ({
							id: variable.name,
							cells: {
								variable: (
									<code className="bcp-email-editor-variable">{`{${variable.name}}`}</code>
								),
								description: variable.description,
								example: variable.example,
							},
						}))}
					/>
					<p className="bcp-secondary-text">
						If a variable has no value (for example {"{location}"} for a custom
						appointment), it is left blank.
					</p>
				</Details>
				<Textarea
					id="body"
					name="body"
					label="Message"
					hint="Use Markdown: ## for headings, - for bullet points, **text** for bold and [text](link) for links. Type a variable in curly brackets and it is replaced with the person's details when the email is sent."
					rows={17}
					monospace
					value={draft.body}
					onChange={update("body")}
					error={errors.body}
				/>
				<ButtonGroup>
					<Button
						type="submit"
						name="intent"
						value="save"
						aria-disabled={pending || undefined}
					>
						Save
					</Button>
					<Button type="submit" name="intent" value="test" variant="secondary">
						Send a test to me
					</Button>
					<Link href={cancelHref}>Cancel</Link>
				</ButtonGroup>
				<p className="bcp-secondary-text">
					A test uses the example details. If a variable has no value, the variable itself
					is sent, for example {"{date}"}.
				</p>
			</form>

			<section aria-labelledby="preview-heading">
				<h2 id="preview-heading" className="bcp-heading-md">
					Preview
				</h2>
				<p className="bcp-secondary-text">
					Shown in the portal email template with example details. Updates as you type.
				</p>
				<Preview
					label="Email preview"
					meta={
						<>
							<strong>From:</strong> {sender.teamName} &lt;{sender.sentFrom}&gt;
							<br />
							<strong>To:</strong> {exampleTo}
							<br />
							<strong>Subject:</strong> {rendered.subject}
							<br />
							<strong>Preheader:</strong> {rendered.preheader || "None"}
						</>
					}
				>
					<EditorFrame title="Email preview" html={rendered.html} />
				</Preview>
				<Details summary="Plain text version">
					<EditorCode>{rendered.text}</EditorCode>
				</Details>
				<Details summary="HTML sent to the webhook">
					<EditorCode>{rendered.html}</EditorCode>
				</Details>
			</section>
		</Editor>
	);
}

const SAMPLE = {
	content:
		"<p>Hello Ellie,</p><p>This is where each email's message goes.</p><h2>A heading</h2><ul><li>A bullet point</li></ul>",
	preheader: "The summary shown after the subject",
};

/** Mockups: AdminEmailLayout. The template's HTML beside a preview that updates as you type. */
export function EmailTemplateEditor({
	action,
	initial,
	teamName,
	cancelHref,
}: {
	action: (state: FormState, formData: FormData) => Promise<FormState>;
	initial: string;
	/** Shown for {team_name} in the preview; each service sends its own. */
	teamName: string;
	cancelHref: string;
}) {
	const [state, formAction, pending] = useActionState(action, {
		values: { html: initial },
		errors: {},
	});
	const [html, setHtml] = useState(initial);
	const preview = html.replace(/\{(content|preheader|team_name)\}/g, (_, name: string) =>
		name === "content" ? SAMPLE.content : name === "preheader" ? SAMPLE.preheader : teamName,
	);

	return (
		<Editor>
			<form action={formAction}>
				<ErrorSummary
					errors={Object.entries(state.errors).map(([fieldId, text]) => ({
						fieldId,
						text,
					}))}
				/>
				<Textarea
					id="html"
					name="html"
					label="HTML"
					hint="The full email template. Put {content} where each email's message goes, {preheader} for the hidden summary at the start, and {team_name} for the team name set in each service's settings."
					rows={40}
					monospace
					spellCheck={false}
					value={html}
					onChange={(event) => setHtml(event.target.value)}
					error={state.errors.html}
				/>
				<ButtonGroup>
					<Button type="submit" aria-disabled={pending || undefined}>
						Save
					</Button>
					<Link href={cancelHref}>Cancel</Link>
				</ButtonGroup>
			</form>
			<section aria-labelledby="preview-heading">
				<h2 id="preview-heading" className="bcp-heading-md">
					Preview
				</h2>
				<p className="bcp-secondary-text">
					With example content. Each service fills in its own team name. Updates as you
					type.
				</p>
				<EditorFrame title="Email template preview" html={preview} />
			</section>
		</Editor>
	);
}

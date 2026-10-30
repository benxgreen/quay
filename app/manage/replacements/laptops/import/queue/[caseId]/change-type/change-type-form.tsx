"use client";

import { useActionState } from "react";
import type { ReplacementType } from "@/components/service/replacements/type-tag";
import { Button, ButtonGroup } from "@/components/ui/button";
import { ErrorSummary } from "@/components/ui/error-summary";
import { InsetText } from "@/components/ui/inset-text";
import { Link } from "@/components/ui/link";
import { Radios } from "@/components/ui/radios";
import { type ChangeTypeState, changeCaseType } from "../../../actions";

type ChangeTypeFormProps = {
	caseId: string;
	reference: string;
	name: string;
	firstName: string;
	position: number;
	type: ReplacementType;
	cancelHref: string;
};

/**
 * Mockups: AdminQueueChangeType. The mockup says "She keeps her place"; we
 * can't know anyone's pronouns, so this says "They".
 */
export function ChangeTypeForm({
	caseId,
	reference,
	name,
	firstName,
	position,
	type,
	cancelHref,
}: ChangeTypeFormProps) {
	const [state, action] = useActionState<ChangeTypeState, FormData>(
		changeCaseType.bind(null, caseId),
		{},
	);

	return (
		<form action={action}>
			<ErrorSummary errors={state.error ? [{ fieldId: "type", text: state.error }] : []} />
			<Radios
				name="type"
				legend={`Change type for ${name}`}
				caption={`Case ${reference} · ${name}`}
				isPageHeading
				legendSize="l"
				hint={`The type decides which dates ${firstName}’s invitation offers. They keep their place in the queue (number ${position}).`}
				error={state.error}
				value={type}
				items={[
					{
						value: "collection",
						label: "Collection",
						hint: "They pick up a laptop that is already set up",
					},
					{
						value: "session",
						label: "Session",
						hint: "An engineer sets up the laptop with them",
					},
				]}
			/>
			<InsetText>
				<p>Once the invitation has been sent, you can change it from the case page.</p>
			</InsetText>
			<ButtonGroup>
				<Button type="submit">Save</Button>
				<Link href={cancelHref}>Cancel</Link>
			</ButtonGroup>
		</form>
	);
}

"use client";

import {
	FormErrors,
	SaveOrCancel,
	type SettingsAction,
	useSettingsForm,
	VariablesList,
} from "@/components/patterns/settings-form";
import { TextInput } from "@/components/ui/text-input";

export function NotesForm({
	action,
	initial,
	variables,
	cancelHref,
}: {
	action: SettingsAction;
	initial: { collectedNote: string; returnedNote: string };
	variables: { name: string; description: string; example: string }[];
	cancelHref: string;
}) {
	const [state, formAction, pending] = useSettingsForm(action, initial);
	const { values, errors } = state;
	return (
		<form action={formAction} key={JSON.stringify(values)}>
			<FormErrors errors={errors} />
			<TextInput
				id="collectedNote"
				name="collectedNote"
				label="When a new laptop is collected"
				hint="For example, Device collected by {full_name} - {case_reference}"
				defaultValue={values.collectedNote}
				error={errors.collectedNote}
			/>
			<TextInput
				id="returnedNote"
				name="returnedNote"
				label="When an old laptop is returned"
				hint="For example, Device returned by {full_name} - {case_reference}"
				defaultValue={values.returnedNote}
				error={errors.returnedNote}
			/>
			<VariablesList variables={variables} />
			<SaveOrCancel cancelHref={cancelHref} pending={pending} />
		</form>
	);
}

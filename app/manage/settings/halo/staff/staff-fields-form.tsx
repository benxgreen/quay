"use client";

import { useActionState, useState } from "react";
import { FormErrors, SaveOrCancel, type SettingsAction } from "@/components/patterns/settings-form";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { readHaloField } from "@/lib/clients/halo/fields";

type Props = {
	action: SettingsAction;
	fields: { key: string; label: string }[];
	options: { value: string; label: string }[];
	sample: Record<string, unknown> | null;
	initial: Record<string, string>;
	cancelHref: string;
};

/** One select per staff detail, with what the chosen field gives for the sample person. */
export function StaffFieldsForm({ action, fields, options, sample, initial, cancelHref }: Props) {
	const [state, formAction, pending] = useActionState(action, { values: initial, errors: {} });
	const [chosen, setChosen] = useState(state.values);
	const example = (key: string) => {
		const value = sample ? readHaloField(sample, chosen[key] || null) : null;
		return value ?? "–";
	};
	const set = (key: string) => (event: { target: { value: string } }) =>
		setChosen((current) => ({ ...current, [key]: event.target.value }));

	return (
		<form action={formAction}>
			<FormErrors errors={state.errors} />
			<Table
				caption="Staff fields"
				captionHidden
				columns={[
					{ key: "detail", header: "Staff detail" },
					{ key: "field", header: "Halo field" },
					{ key: "example", header: "Example" },
				]}
				rows={fields.map(({ key, label }) => ({
					id: key,
					cells: {
						detail: label,
						field: (
							<Select
								id={key}
								name={key}
								label={
									<span className="sr-only">
										Halo field for {label.toLowerCase()}
									</span>
								}
								value={chosen[key]}
								onChange={set(key)}
								error={state.errors[key]}
								options={[{ value: "", label: "Not used" }, ...options]}
							/>
						),
						example: example(key),
					},
				}))}
			/>
			<SaveOrCancel cancelHref={cancelHref} pending={pending} />
		</form>
	);
}

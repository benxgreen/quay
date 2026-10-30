"use client";

import "./checklist.css";

import { type ReactNode, useEffect, useId, useState } from "react";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkboxes";

export type ChecklistItem = { value: string; label: string; ticked: boolean };

type ChecklistProps = {
	/** Accessible name for the group, such as "Device preparation checks". */
	legend: string;
	/** Field name for the ticked values. */
	name: string;
	items: ChecklistItem[];
	/** Server action. The pressed button sends intent=save or intent=confirm. */
	action: (formData: FormData) => void | Promise<void>;
	/** The secondary button, such as "Save preparation checks". */
	saveText: string;
	/** The primary button, such as "Confirm device prepared". */
	confirmText: string;
	/** Under the list, such as "Saved by John Smith at 2:15pm". */
	saved?: ReactNode;
	/** Before the buttons, such as a WarningText. */
	beforeButtons?: ReactNode;
};

/**
 * A checklist whose ticks aren't saved until asked (spec, "Saving
 * checklists"): a secondary save button, and a primary button that saves
 * and moves on once everything is ticked. Unsaved ticks show "You have
 * unsaved changes" and leaving the page warns. The count is announced.
 */
export function Checklist({
	legend,
	name,
	items,
	action,
	saveText,
	confirmText,
	saved,
	beforeButtons,
}: ChecklistProps) {
	const id = useId();
	const initial = items.filter((item) => item.ticked).map((item) => item.value);
	const [ticked, setTicked] = useState<string[]>(initial);
	const dirty =
		ticked.length !== initial.length || ticked.some((value) => !initial.includes(value));

	useEffect(() => {
		if (!dirty) return;
		const warn = (event: BeforeUnloadEvent) => event.preventDefault();
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [dirty]);

	return (
		<form action={action} className="bcp-checklist">
			<fieldset className="bcp-checklist-items">
				<legend className="sr-only">{legend}</legend>
				{items.map((item, index) => (
					<Checkbox
						key={item.value}
						id={`${id}-${index}`}
						name={name}
						value={item.value}
						label={item.label}
						checked={ticked.includes(item.value)}
						onChange={(event) =>
							setTicked((current) =>
								event.target.checked
									? [...current, item.value]
									: current.filter((value) => value !== item.value),
							)
						}
					/>
				))}
			</fieldset>
			<p className="bcp-checklist-count" aria-live="polite">
				{ticked.length} of {items.length} done
			</p>
			{dirty ? (
				<p className="bcp-checklist-unsaved" role="status">
					You have unsaved changes
				</p>
			) : saved ? (
				<p className="bcp-checklist-saved">{saved}</p>
			) : null}
			{beforeButtons}
			<ButtonGroup>
				<Button type="submit" name="intent" value="confirm">
					{confirmText}
				</Button>
				<Button type="submit" name="intent" value="save" variant="secondary">
					{saveText}
				</Button>
			</ButtonGroup>
		</form>
	);
}

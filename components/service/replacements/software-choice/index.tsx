import type { ReactNode } from "react";
import { AddAnother } from "@/components/patterns/add-another";
import { Checkboxes } from "@/components/ui/checkboxes";
import { Fieldset } from "@/components/ui/form-group";

type SoftwareChoiceProps = {
	list: { name: string; hint: string | null }[];
	/** Names on the list already chosen. */
	selected: string[];
	/** Software typed in before, not on the list. */
	other: string[];
	legend: ReactNode;
	caption?: ReactNode;
	isPageHeading?: boolean;
	hint?: ReactNode;
	error?: string;
};

/**
 * "What software do you need?" (mockups: UserSoftware): one checkbox per
 * name on the software list with its hint, then "Other software", one box
 * per program with "Add another". Colleague pages say "software", never
 * "business applications".
 */
export function SoftwareChoice({
	list,
	selected,
	other,
	legend,
	caption,
	isPageHeading = true,
	hint,
	error,
}: SoftwareChoiceProps) {
	return (
		<>
			<Checkboxes
				name="software"
				legend={legend}
				caption={caption}
				isPageHeading={isPageHeading}
				legendSize={isPageHeading ? "l" : "m"}
				hint={hint}
				error={error}
				values={selected}
				items={list.map((item) => ({
					value: item.name,
					label: item.name,
					hint: item.hint ?? undefined,
				}))}
			/>
			<Fieldset legend={<h2 className="bcp-heading-md">Other software</h2>}>
				<p className="bcp-secondary-text">
					If something you need is not listed, add it here. One per box.
				</p>
				<AddAnother
					name="other"
					itemLabel="Software"
					defaultValues={other.length ? other : [""]}
					max={10}
				/>
			</Fieldset>
		</>
	);
}

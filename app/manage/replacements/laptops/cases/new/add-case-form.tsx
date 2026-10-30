"use client";

import { useActionState } from "react";
import { LookupField, LookupResult } from "@/components/patterns/lookup-field";
import { Button, ButtonGroup } from "@/components/ui/button";
import { ErrorSummary } from "@/components/ui/error-summary";
import { Link } from "@/components/ui/link";
import { Radios } from "@/components/ui/radios";
import { SummaryList, SummaryListSecondary } from "@/components/ui/summary-list";
import { Tag } from "@/components/ui/tag";
import { type AddCaseState, addCaseStep } from "./actions";

const INITIAL: AddCaseState = {
	values: { serial: "", same: "", email: "", type: "", next: "" },
	errors: {},
};

/** Mockups: AdminAddCase. */
export function AddCaseForm({ cancelHref }: { cancelHref: string }) {
	const [state, action, pending] = useActionState(addCaseStep, INITIAL);
	const { values, device, person, errors } = state;
	const assigned = device?.assignedName ?? "the assigned user";

	const summary = [
		errors.serial && { fieldId: "serial", text: errors.serial },
		errors.same && { fieldId: "same", text: errors.same },
		errors.email && { fieldId: "email", text: errors.email },
		errors.type && { fieldId: "type", text: errors.type },
		errors.next && { fieldId: "next", text: errors.next },
	].filter((item): item is { fieldId: string; text: string } => Boolean(item));

	return (
		<form action={action} key={JSON.stringify(values)}>
			<ErrorSummary errors={summary} />

			<section>
				<p className="bcp-caption">Step 1 of 3</p>
				<h2>Which laptop is being replaced?</h2>
				<LookupField
					id="serial"
					name="serial"
					label="Serial number"
					hint="Usually on a sticker underneath the laptop"
					buttonText="Find device"
					buttonName="intent"
					buttonValue="find-device"
					defaultValue={values.serial}
					error={errors.serial}
				>
					{device ? (
						<LookupResult
							title={device.hostname}
							tag={<Tag colour="green">Found in Halo</Tag>}
							confirmation={
								device.problem
									? undefined
									: "No active case for this device and not previously replaced."
							}
						>
							<SummaryList
								compact
								rows={[
									{ key: "Asset ID", value: device.assetId },
									{ key: "Model", value: device.model },
									{
										key: "Assigned user in Halo",
										value: device.assignedName ? (
											<>
												{device.assignedName}
												<SummaryListSecondary>
													{[
														device.assignedEmail,
														device.assignedJob,
														device.assignedDepartment,
													]
														.filter(Boolean)
														.join(" · ")}
												</SummaryListSecondary>
											</>
										) : (
											"None"
										),
									},
								]}
							/>
						</LookupResult>
					) : null}
				</LookupField>
			</section>

			<section>
				<p className="bcp-caption">Step 2 of 3</p>
				<Radios
					name="same"
					idPrefix="same"
					legend={
						<h2 className="bcp-heading-ml">
							Is the person receiving the new laptop the same as the assigned user?
						</h2>
					}
					error={errors.same}
					value={values.same}
					items={[
						{ value: "yes", label: `Yes, ${assigned}` },
						{
							value: "no",
							label: "No, someone else is receiving it",
							conditional: (
								<LookupField
									id="email"
									name="email"
									type="email"
									label="Email address of the person receiving the laptop"
									buttonText="Find person"
									buttonName="intent"
									buttonValue="find-person"
									defaultValue={values.email}
									error={errors.email}
								>
									{person ? (
										<LookupResult
											title={person.name}
											confirmation={`Found in the staff directory. Invitations and booking emails will go to ${person.name.split(" ")[0]}.`}
										>
											<SummaryList
												compact
												rows={[
													{
														key: "Job title",
														value: person.jobTitle ?? "–",
													},
													{
														key: "Department",
														value: person.department ?? "–",
													},
												]}
											/>
										</LookupResult>
									) : null}
								</LookupField>
							),
						},
					]}
				/>
			</section>

			<section>
				<p className="bcp-caption">Step 3 of 3</p>
				<Radios
					name="type"
					legend={<h2 className="bcp-heading-ml">Type</h2>}
					error={errors.type}
					value={values.type}
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
				<Radios
					name="next"
					legend={<h2 className="bcp-heading-ml">What happens next?</h2>}
					error={errors.next}
					value={values.next}
					items={[
						{
							value: "queue",
							label: "Add to the invitation queue",
							hint: "They get an invitation in the next daily batch",
						},
						{
							value: "book",
							label: "Book on their behalf now",
							hint: "Choose a date and their software next. No invitation is sent.",
						},
					]}
				/>
			</section>

			<ButtonGroup>
				<Button
					type="submit"
					name="intent"
					value="add"
					aria-disabled={pending || undefined}
				>
					Add case
				</Button>
				<Link href={cancelHref}>Cancel</Link>
			</ButtonGroup>
		</form>
	);
}

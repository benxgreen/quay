import type { ReactNode } from "react";
import { Checklist } from "@/components/patterns/checklist";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkboxes";
import { DateInput } from "@/components/ui/date-input";
import { Details } from "@/components/ui/details";
import { InsetText } from "@/components/ui/inset-text";
import { Link, LinkButton } from "@/components/ui/link";
import { Select } from "@/components/ui/select";
import { type Step, StepList } from "@/components/ui/step-list";
import { Textarea } from "@/components/ui/textarea";
import { WarningText } from "@/components/ui/warning-text";
import { londonToday } from "@/lib/clock";
import { formatFullDate, formatShortDateTime } from "@/lib/dates/format";
import { BEFORE_COMPLETION } from "@/services/replacements/laptops/lib/case-status";
import { STEP_TITLES } from "@/services/replacements/laptops/lib/case-steps";
import type { CaseDetail } from "@/services/replacements/laptops/lib/cases";
import type { HaloStockDevice } from "@/services/replacements/laptops/lib/halo";
import type { ChecklistChange, StepData } from "@/services/replacements/laptops/lib/steps";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import {
	allocateAction,
	completeAction,
	decommissionAction,
	preparationAction,
	remindersAction,
	reopenAction,
	returnedAction,
	softwareAction,
	unallocateAction,
	updateChecklistAction,
} from "../step-actions";

const LOCKED = (
	<p className="bcp-secondary-text">Locked because the replacement has been completed.</p>
);
const SETTINGS = `${LAPTOPS_SECTIONS.settings.href}`;

/**
 * The six replacement steps (mockups: AdminCase). Each unlocks when the one
 * before is done. Up to step 4 the team can step back: unallocate, or
 * reopen step 2 or 3. An archived case shows every step read-only.
 */
export function CaseSteps({
	detail,
	data,
	devices,
}: {
	detail: CaseDetail;
	data: StepData;
	/** Devices that can be allocated, when on step 1. */
	devices: HaloStockDevice[];
}) {
	const { reference, step, progress, boxNumber, booking, person } = detail;
	const first = person.firstName;
	const live = !detail.archived;
	const canGoBack = live && BEFORE_COMPLETION.includes(detail.status);
	const locked = !canGoBack && progress.attendedAt !== null;
	const status = (n: number): Step["status"] =>
		detail.status === "completed" || (step !== null && n < step)
			? "done"
			: n === step
				? "current"
				: "not-started";
	const by = (who: string | null, at: Date | null) =>
		at ? `${formatFullDate(at)}${who ? ` by ${who}` : ""}` : "";
	const saved = (key: keyof StepData["saved"]) => {
		const last = data.saved[key];
		return last ? `Last saved by ${last.by}, ${formatShortDateTime(last.at)}` : undefined;
	};

	const content: Record<number, ReactNode> = {
		1:
			status(1) === "done" || boxNumber ? (
				<>
					<p>
						Box number {boxNumber} is allocated to this case
						{progress.allocatedAt
							? ` (${by(progress.allocatedBy, progress.allocatedAt)})`
							: ""}
						.
					</p>
					{canGoBack && boxNumber ? (
						<Details summary="Unallocate device">
							<form action={unallocateAction.bind(null, reference)}>
								<Textarea
									id="unallocate-reason"
									name="reason"
									label="Reason (optional)"
									hint="Saved in the case and device journals, for example “Device faulty”."
									rows={2}
								/>
								<Button type="submit" variant="secondary">
									Unallocate device
								</Button>
							</form>
						</Details>
					) : null}
					{locked ? LOCKED : null}
				</>
			) : live && status(1) === "current" ? (
				devices.length > 0 ? (
					<form action={allocateAction.bind(null, reference)}>
						<Select
							id="box"
							name="box"
							label="Box number"
							hint="Devices available in Halo stock. Allocating only ties the device to this case; Halo is not updated yet."
							options={devices.map((device) => ({
								value: device.assetId,
								label: `${device.assetId} · ${device.hostname} · ${device.model}`,
							}))}
						/>
						<Button type="submit">Allocate</Button>
					</form>
				) : (
					<p>
						No devices are available in stock.{" "}
						<Link href={LAPTOPS_SECTIONS.stock.href}>Check Stock</Link>, or refresh it
						from Halo.
					</p>
				)
			) : (
				<p className="bcp-secondary-text">No device was allocated.</p>
			),

		2:
			status(2) === "done" ? (
				<>
					<p>
						All {data.prepChecks.length} preparation checks done on box {boxNumber}
						{progress.devicePreparedAt
							? `, confirmed ${by(progress.devicePreparedBy, progress.devicePreparedAt)}`
							: ""}
						.
					</p>
					{detail.archived ? (
						<DoneChecks checks={data.prepChecks.map((check) => check.label)} />
					) : null}
					{canGoBack ? <ReopenButton reference={reference} step={2} /> : null}
					{locked ? LOCKED : null}
				</>
			) : live && status(2) === "current" ? (
				<>
					<p className="bcp-secondary-text">
						Work through the preparation checks for box {boxNumber}. The checks are
						managed in <Link href={SETTINGS}>Settings</Link>.
					</p>
					<ChangedNotice
						change={data.prepChange}
						action={updateChecklistAction.bind(null, reference, "device_preparation")}
					/>
					<Checklist
						legend="Device preparation checks"
						name="check"
						items={data.prepChecks.map((check) => ({
							value: check.id,
							label: check.label,
							ticked: check.ticked,
						}))}
						action={preparationAction.bind(null, reference)}
						saveText="Save preparation checks"
						confirmText="Confirm device prepared"
						saved={saved("device_preparation")}
					/>
				</>
			) : (
				<p className="bcp-secondary-text">Available after a device is allocated.</p>
			),

		3:
			status(3) === "done" ? (
				<>
					<p>
						{booking && booking.software.length > 0
							? `All ${booking.software.length} requested applications installed on box ${boxNumber}: ${booking.software.join(", ")}.`
							: progress.softwarePreparedAt
								? `Software prepared ${by(progress.softwarePreparedBy, progress.softwarePreparedAt)}.`
								: "No software was requested."}
					</p>
					{canGoBack && progress.softwarePreparedAt ? (
						<ReopenButton reference={reference} step={3} />
					) : null}
					{locked ? LOCKED : null}
				</>
			) : live && status(3) === "current" ? (
				booking ? (
					<>
						<p className="bcp-secondary-text">
							{first} requested these. Tick each one once it is installed on box{" "}
							{boxNumber}.
						</p>
						<Checklist
							legend="Software installed"
							name="software"
							items={booking.software.map((name) => ({
								value: name,
								label: name,
								ticked: data.softwareTicked.includes(name),
							}))}
							action={softwareAction.bind(null, reference)}
							saveText="Save software"
							confirmText="Confirm software prepared"
							saved={saved("software")}
						/>
					</>
				) : (
					<p className="bcp-secondary-text">
						Waiting for {first} to book and choose their software.
					</p>
				)
			) : (
				<p className="bcp-secondary-text">Available after the device has been prepared.</p>
			),

		4:
			status(4) === "done" ? (
				<p>
					Completed on {progress.attendedAt ? formatFullDate(progress.attendedAt) : "–"}.
					Halo updated: box {boxNumber} is In Service and assigned to {person.name}, stock
					location and stock room cleared, audit details set.
				</p>
			) : live && status(4) === "current" ? (
				booking ? (
					<form action={completeAction.bind(null, reference)}>
						<p>
							Use this when {first} has collected their laptop or attended their
							session.
						</p>
						<WarningText>
							This updates Halo and cannot be undone. Box {boxNumber} is set to In
							Service and assigned to {person.name}, its stock location and stock room
							are cleared, and its audit details are updated to today.
						</WarningText>
						<Button type="submit">Complete replacement</Button>
					</form>
				) : (
					<p className="bcp-secondary-text">Available once {first} is booked.</p>
				)
			) : (
				<p className="bcp-secondary-text">
					Available after the software has been prepared.
				</p>
			),

		5:
			status(5) === "done" ? (
				<p>
					Old laptop (asset {detail.oldDevice.assetId}
					{detail.oldDevice.hostname ? `, ${detail.oldDevice.hostname}` : ""}) returned on{" "}
					{progress.returnedAt ? formatFullDate(progress.returnedAt) : "–"}
					{progress.returnedBy ? `, recorded by ${progress.returnedBy}` : ""}.
				</p>
			) : live && status(5) === "current" ? (
				<ReturnStep detail={detail} reminders={data.returnReminders} />
			) : (
				<p className="bcp-secondary-text">Available after the replacement is completed.</p>
			),

		6:
			status(6) === "done" ? (
				<>
					<p>
						Decommissioned on{" "}
						{progress.decommissionedAt
							? formatFullDate(progress.decommissionedAt)
							: "–"}
						{progress.decommissionedBy ? ` by ${progress.decommissionedBy}` : ""}. The
						decommission call succeeded.
					</p>
					{detail.archived ? (
						<DoneChecks checks={data.decommissionChecks.map((check) => check.label)} />
					) : null}
				</>
			) : live && status(6) === "current" ? (
				<>
					<p className="bcp-secondary-text">
						Work through the decommission checklist for asset {detail.oldDevice.assetId}
						. The checklist is managed in <Link href={SETTINGS}>Settings</Link>.
					</p>
					<ChangedNotice
						change={data.decommissionChange}
						action={updateChecklistAction.bind(null, reference, "decommission")}
					/>
					<Checklist
						legend="Decommission checklist"
						name="check"
						items={data.decommissionChecks.map((check) => ({
							value: check.id,
							label: check.label,
							ticked: check.ticked,
						}))}
						action={decommissionAction.bind(null, reference)}
						saveText="Save decommission checks"
						confirmText="Decommission old device"
						saved={saved("decommission")}
						beforeButtons={
							<WarningText>
								This runs the decommission call and cannot be undone.
							</WarningText>
						}
					/>
				</>
			) : (
				<p className="bcp-secondary-text">Available after the old device is returned.</p>
			),
	};

	return (
		<StepList
			steps={STEP_TITLES.map((title, index) => ({
				id: `step-${index + 1}`,
				title,
				status: status(index + 1),
				content: content[index + 1],
			}))}
		/>
	);
}

function ReopenButton({ reference, step }: { reference: string; step: 2 | 3 }) {
	return (
		<form action={reopenAction.bind(null, reference, step)}>
			<Button type="submit" variant="secondary">
				Reopen
			</Button>
		</form>
	);
}

function DoneChecks({ checks }: { checks: string[] }) {
	return (
		<ul>
			{checks.map((label) => (
				<li key={label}>{label}</li>
			))}
		</ul>
	);
}

/** "The checklist has changed in Settings since this step started", with Update to latest list. */
function ChangedNotice({
	change,
	action,
}: {
	change: ChecklistChange | null;
	action: () => Promise<void>;
}) {
	if (!change) return null;
	const parts = [
		change.added.length
			? `added: ${change.added.map((label) => `“${label}”`).join(", ")}`
			: null,
		change.removed.length
			? `removed: ${change.removed.map((label) => `“${label}”`).join(", ")}`
			: null,
	].filter(Boolean);
	return (
		<InsetText>
			<p>
				The checklist has changed in Settings since this step started ({parts.join("; ")}).
			</p>
			<form action={action}>
				<LinkButton>Update to latest list</LinkButton>{" "}
				<span className="bcp-secondary-text">· ticks you have saved are kept</span>
			</form>
		</InsetText>
	);
}

function ReturnStep({ detail, reminders }: { detail: CaseDetail; reminders: boolean }) {
	const [year, month, day] = londonToday().split("-");
	const first = detail.person.firstName;
	return (
		<>
			<p>
				Use this once the old laptop (asset {detail.oldDevice.assetId}
				{detail.oldDevice.hostname ? `, ${detail.oldDevice.hostname}` : ""}) is back with
				the team.
			</p>
			<form action={remindersAction.bind(null, detail.reference)}>
				<Checkbox
					id="reminders"
					name="reminders"
					value="on"
					label={`Send ${first} reminder emails to return their old laptop`}
					defaultChecked={reminders}
				/>
				<p className="bcp-secondary-text bcp-body-small">
					Weekly, on the return reminder day in Settings, until the laptop is back.
				</p>
				<Button type="submit" variant="secondary">
					Save reminder setting
				</Button>
			</form>
			<form action={returnedAction.bind(null, detail.reference)}>
				<DateInput
					name="returned"
					legend="Date returned"
					legendSize="s"
					hint="For example, 12 11 2026. Defaults to today."
					value={{ day: String(Number(day)), month: String(Number(month)), year }}
				/>
				<WarningText>
					This updates the old device in Halo and can only be done once.
				</WarningText>
				<ButtonGroup>
					<Button type="submit">Mark old device as returned</Button>
				</ButtonGroup>
			</form>
		</>
	);
}

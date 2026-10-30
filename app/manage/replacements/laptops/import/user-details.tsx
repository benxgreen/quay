"use client";

import { useState } from "react";
import { InfoButton } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Note } from "@/components/ui/note";
import { SummaryList } from "@/components/ui/summary-list";
import { Table, TableSecondary } from "@/components/ui/table";
import type { UserDetails as Details } from "@/services/replacements/laptops/lib/import";
import { loadUserDetails } from "./actions";

const AGO_DAYS = 14;

function daysSince(iso: string): number {
	return Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
}

function ago(iso: string): string {
	const days = daysSince(iso);
	if (days <= 0) return "Today";
	if (days === 1) return "Yesterday";
	if (days < 14) return `${days} days ago`;
	if (days < 56) return `${Math.floor(days / 7)} weeks ago`;
	return new Date(iso).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

/**
 * The "i" button on an eligible laptop and its dialog (mockups:
 * AdminImportDetails): the person's details and every device assigned to
 * them in Halo, read when it opens, so the team can spot a shared or spare
 * laptop before importing it.
 */
export function UserDetails({
	name,
	email,
	assetId,
}: {
	name: string;
	email: string;
	assetId: string;
}) {
	const [details, setDetails] = useState<Details | null>(null);
	const [failed, setFailed] = useState(false);

	return (
		<Modal
			caption="User details"
			title={name}
			trigger={(open) => (
				<InfoButton
					label={`User details for ${name}`}
					aria-haspopup="dialog"
					onClick={() => {
						open();
						if (!details) {
							loadUserDetails(email)
								.then(setDetails)
								.catch(() => setFailed(true));
						}
					}}
				/>
			)}
		>
			{failed ? (
				<p>
					Halo could not be reached, so the details can’t be shown. Try again in a few
					minutes.
				</p>
			) : !details ? (
				<p role="status">Loading the details from Halo…</p>
			) : (
				<DetailsBody details={details} name={name} email={email} assetId={assetId} />
			)}
		</Modal>
	);
}

function DetailsBody({
	details: { user, devices },
	name,
	email,
	assetId,
}: {
	details: Details;
	name: string;
	email: string;
	assetId: string;
}) {
	const firstName = name.split(" ")[0];
	const otherLaptopsSeen = devices.filter(
		(device) =>
			device.assetId !== assetId &&
			device.assetType === "Laptop" &&
			daysSince(device.lastSeen) < AGO_DAYS,
	);
	const signedInLongAgo = user?.lastSignIn ? daysSince(user.lastSignIn) >= 30 : false;
	const warnings = [
		otherLaptopsSeen.length > 0
			? `${firstName} has another laptop that was seen ${ago(otherLaptopsSeen[0].lastSeen).toLowerCase()}`
			: null,
		signedInLongAgo && user?.lastSignIn
			? `has not signed in since ${new Date(user.lastSignIn).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`
			: null,
	].filter(Boolean);

	return (
		<>
			<h3>Details</h3>
			<SummaryList
				compact
				rows={[
					{ key: "Email", value: email },
					{ key: "Job title", value: user?.jobTitle ?? "–" },
					{ key: "Department", value: user?.department ?? "–" },
					{
						key: "Last sign in",
						value: user?.lastSignIn
							? new Date(user.lastSignIn).toLocaleDateString("en-GB", {
									day: "numeric",
									month: "long",
									year: "numeric",
								})
							: "–",
					},
					{
						key: "Account",
						value: user
							? user.active
								? "Enabled"
								: "Disabled"
							: "Not in the directory",
					},
				]}
			/>
			<h3>Devices assigned in Halo ({devices.length})</h3>
			<Table
				caption={`Devices assigned to ${name} in Halo`}
				captionHidden
				columns={[
					{ key: "device", header: "Device" },
					{ key: "type", header: "Type" },
					{ key: "seen", header: "Last seen" },
				]}
				rows={devices.map((device) => ({
					id: device.assetId,
					cells: {
						device: (
							<>
								{device.hostname || `Asset ${device.assetId}`}
								<TableSecondary>
									{device.assetId === assetId
										? "This laptop"
										: `Asset ${device.assetId}`}{" "}
									· {device.model}
								</TableSecondary>
							</>
						),
						type: device.assetType,
						seen: ago(device.lastSeen),
					},
				}))}
			/>
			{warnings.length > 0 ? (
				<Note variant="check">
					<p>
						<strong>Check before importing.</strong> {warnings.join(", and ")}. This
						laptop may be shared or a spare.
					</p>
				</Note>
			) : null}
		</>
	);
}

"use client";

import "@/components/ui/button/button.css";
import "./pending-button.css";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ButtonVariant } from "@/components/ui/button";
import { classNames } from "@/lib/utils/class-names";

type PendingButtonProps = {
	children: ReactNode;
	/** Shown while the form is submitting, such as "Refreshing from Halo…". */
	pendingText: string;
	variant?: ButtonVariant;
	small?: boolean;
	name?: string;
	value?: string;
};

/**
 * A submit button for something slow, such as "Refresh from Halo". While
 * its form is submitting it says what's happening, is marked aria-disabled
 * (it stays focusable, so focus isn't lost) and ignores further presses,
 * and a polite status message tells screen reader users. The GOV.UK way:
 * words, not a spinner. Works in any form, server action or not.
 *
 * @example
 * <form action={refreshStockAction}>
 *   <PendingButton variant="secondary" pendingText="Refreshing from Halo…">Refresh from Halo</PendingButton>
 * </form>
 */
export function PendingButton({
	children,
	pendingText,
	variant = "primary",
	small,
	name,
	value,
}: PendingButtonProps) {
	const { pending } = useFormStatus();
	return (
		<>
			<button
				type="submit"
				name={name}
				value={value}
				className={classNames(
					"bcp-button",
					variant !== "primary" && `bcp-button--${variant}`,
					small && "bcp-button--small",
					pending && "bcp-pending-button--pending",
				)}
				aria-disabled={pending || undefined}
				onClick={(event) => {
					if (pending) event.preventDefault();
				}}
			>
				{pending ? pendingText : children}
			</button>
			<span className="sr-only" role="status">
				{pending ? pendingText : ""}
			</span>
		</>
	);
}

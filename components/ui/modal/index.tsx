"use client";

import "@/components/ui/button/button.css";
import "./modal.css";

import type { ReactNode } from "react";
import { useCallback, useId, useRef } from "react";

type ModalProps = {
	/** Renders the button that opens the modal, given the function that opens it. */
	trigger: (open: () => void) => ReactNode;
	caption?: ReactNode;
	title: ReactNode;
	children: ReactNode;
	/** Shown on the left of the footer, for example a link to the record in Halo. */
	footerStart?: ReactNode;
};

/**
 * Extra detail without leaving the page, such as a user's details and
 * devices on the import screen. Uses the native `<dialog>`, so focus moves
 * into it, the rest of the page is inert and Escape closes it. Focus returns
 * to the button that opened it. One Close button, bottom right.
 *
 * @example
 * <Modal
 *   caption="User details"
 *   title="Leah Turner"
 *   trigger={(open) => <InfoButton label="User details for Leah Turner" onClick={open} />}
 * >
 *   …
 * </Modal>
 */
export function Modal({ trigger, caption, title, children, footerStart }: ModalProps) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const openerRef = useRef<HTMLElement | null>(null);
	const titleId = useId();

	const open = useCallback(() => {
		openerRef.current = document.activeElement as HTMLElement | null;
		dialogRef.current?.showModal();
	}, []);

	const close = useCallback(() => {
		dialogRef.current?.close();
	}, []);

	// Runs for the Close button and for Escape.
	const handleClose = useCallback(() => {
		openerRef.current?.focus();
	}, []);

	return (
		<>
			{trigger(open)}
			<dialog
				ref={dialogRef}
				className="bcp-modal"
				aria-labelledby={titleId}
				onClose={handleClose}
			>
				<div className="bcp-modal-header">
					{caption ? <span className="bcp-modal-caption">{caption}</span> : null}
					<h2 className="bcp-modal-title" id={titleId}>
						{title}
					</h2>
				</div>
				<div className="bcp-modal-body">{children}</div>
				<div className="bcp-modal-footer">
					<div>{footerStart}</div>
					<button
						type="button"
						className="bcp-button bcp-button--secondary bcp-modal-close"
						onClick={close}
					>
						Close
					</button>
				</div>
			</dialog>
		</>
	);
}

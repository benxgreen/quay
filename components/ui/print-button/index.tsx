"use client";

import "@/components/ui/button/button.css";
import "./print-button.css";

import type { ReactNode } from "react";

/**
 * A secondary button that opens the browser's print dialog, such as "Print
 * attendee list". It hides itself in the printout.
 */
export function PrintButton({ children }: { children: ReactNode }) {
	return (
		<button
			type="button"
			className="bcp-button bcp-button--secondary bcp-print-button"
			onClick={() => window.print()}
		>
			{children}
		</button>
	);
}

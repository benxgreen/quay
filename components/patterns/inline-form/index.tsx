import "./inline-form.css";

import type { ReactNode } from "react";

/**
 * Fields and their button on one row, under a list, such as "Add software"
 * and its hint with an Add button. The row wraps on narrow screens.
 *
 * @example
 * <form action={add}><InlineForm><TextInput … /><Button type="submit">Add</Button></InlineForm></form>
 */
export function InlineForm({ children }: { children: ReactNode }) {
	return <div className="bcp-inline-form">{children}</div>;
}

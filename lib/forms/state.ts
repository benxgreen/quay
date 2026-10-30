/**
 * What a form's server action returns when something needs correcting: the
 * values as typed and an error per field. Shared by every settings form.
 */
export type FormState = {
	values: Record<string, string>;
	errors: Record<string, string>;
	/** Show a preview of what was typed (such as page content). */
	preview?: boolean;
	/** The result of a test send, such as an email sent to yourself. */
	test?: { ok: boolean; message: string };
};

/** Joins the truthy class names, so conditional classes read cleanly. */
export function classNames(...names: Array<string | false | null | undefined>): string {
	return names.filter(Boolean).join(" ");
}

/** Joins the ids for aria-describedby, or returns undefined when there are none. */
export function describedBy(...ids: Array<string | false | null | undefined>): string | undefined {
	const joined = classNames(...ids);
	return joined || undefined;
}

import type { ReplacementType } from "@/components/service/replacements/type-tag";
import { formatLongDate, formatTime } from "@/lib/dates/format";
import type { IsoDate } from "@/lib/dates/working-days";

export const LAPTOP_PAGE = "/my/replacements/laptop";

/** What each type involves, in the colleague's words. */
export const TYPE_WORDS: Record<
	ReplacementType,
	{ name: string; involves: string; book: string; choose: string }
> = {
	session: {
		name: "Session",
		involves: "An engineer sets up your new laptop with you.",
		book: "Book a session with an engineer, who will set up your new laptop with you.",
		choose: "An engineer will set up your new laptop with you.",
	},
	collection: {
		name: "Collection",
		involves: "You collect a new laptop that is already set up for you.",
		book: "Book a time to collect your new laptop, which will already be set up for you.",
		choose: "Your new laptop will be set up and ready for you to collect.",
	},
};

/** "Thursday 12 November 2026 at 9:30am". */
export function when(date: IsoDate, time: string): string {
	return `${formatLongDate(date, { year: true })} at ${formatTime(time)}`;
}

/** Query string carrying the signed case link through the booking pages. */
export function withCase(
	token: string | undefined,
	params: Record<string, string | string[]> = {},
): string {
	const search = new URLSearchParams();
	if (token) search.set("case", token);
	for (const [key, value] of Object.entries(params)) {
		for (const one of [value].flat()) search.append(key, one);
	}
	const text = search.toString();
	return text ? `?${text}` : "";
}

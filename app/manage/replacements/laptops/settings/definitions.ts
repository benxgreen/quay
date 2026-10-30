import type { ServiceSettings } from "@/services/replacements/laptops/lib/settings";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";

export const SETTINGS = LAPTOPS_SECTIONS.settings.href;

/**
 * The number settings under Invitations and reminders, which share one
 * page (mockups: AdminSettingNumber). The address is /settings/invitations/<slug>.
 */
export const NUMBER_SETTINGS = {
	invitations: {
		key: "invitationsPerWorkingDay",
		title: "Invitations per working day",
		hint: "How many cases are sent their invitation from the queue at 9:00am each working day.",
		suffix: "invitations",
		min: 1,
		max: 200,
		inset: "Changing this updates the estimated invitation dates in the queue straight away. The next batch uses the new number.",
	},
	flag: {
		key: "flagAfterReminders",
		title: "Flag case after",
		hint: "A case is flagged automatically when this reminder is sent. Flagging never pauses reminders.",
		suffix: "reminders",
		min: 1,
		max: 20,
		inset: "Cases that have already had this many reminders are not flagged again.",
	},
	lead: {
		key: "bookingLeadWorkingDays",
		title: "Booking lead time",
		hint: "Colleagues can only book sessions more than this many working days away. The team can book on their behalf at any time.",
		suffix: "working days",
		min: 0,
		max: 30,
		inset: "Existing bookings are not affected.",
	},
	lock: {
		key: "softwareLockWorkingDays",
		title: "Software lock",
		hint: "Requested software locks at midnight this many working days before the session. Session reminders are sent on the same day.",
		suffix: "working days before the session",
		min: 0,
		max: 20,
		inset: "After the lock only the team can change software, recorded as an override.",
	},
} as const satisfies Record<
	string,
	{
		key: keyof ServiceSettings;
		title: string;
		hint: string;
		suffix: string;
		min: number;
		max: number;
		inset: string;
	}
>;

export type NumberSettingSlug = keyof typeof NUMBER_SETTINGS;

export function isNumberSetting(slug: string): slug is NumberSettingSlug {
	return slug in NUMBER_SETTINGS;
}

/** Success banners on the Settings page, keyed by ?saved=. */
export const SAVED_MESSAGES: Record<string, string> = {
	"software-added": "Software added",
	"software-saved": "Software saved",
	"software-removed": "Software removed",
	"faq-added": "Question added",
	"faq-saved": "Question saved",
	"faq-removed": "Question removed",
	content: "Page content saved",
	defaults: "Session defaults saved",
	setting: "Setting saved",
	"check-added": "Check added",
	"check-saved": "Check saved",
	"check-removed": "Check removed",
};

/** A whole number within limits, or an error message. */
export function readWholeNumber(
	raw: string,
	{ min, max, name }: { min: number; max: number; name: string },
): { value: number } | { error: string } {
	const text = raw.trim();
	if (!text) return { error: `Enter ${name}` };
	if (!/^\d+$/.test(text)) return { error: `${capitalise(name)} must be a whole number` };
	const value = Number(text);
	if (value < min) return { error: `${capitalise(name)} must be ${min} or more` };
	if (value > max) return { error: `${capitalise(name)} must be ${max} or fewer` };
	return { value };
}

function capitalise(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

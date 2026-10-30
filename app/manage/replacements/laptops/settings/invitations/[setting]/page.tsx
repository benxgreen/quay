import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { PageHeading } from "@/components/ui/page-heading";
import { requireRole } from "@/lib/auth/guards";
import { getBankHolidaysClient } from "@/lib/clients/bank-holidays";
import { londonToday } from "@/lib/clock";
import { formatLongDate } from "@/lib/dates/format";
import { addDays, type IsoDate, isWeeklySendDay } from "@/lib/dates/working-days";
import { ACCESS, canAccess } from "@/lib/portal/access";
import { getServiceSettings, WEEKDAYS } from "@/services/replacements/laptops/lib/settings";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import {
	saveNumberSettingAction,
	saveReminderAction,
	saveReturnRemindersAction,
} from "../../actions";
import { isNumberSetting, NUMBER_SETTINGS, SETTINGS } from "../../definitions";
import { NumberForm, ReminderForm, ReturnRemindersForm } from "../../forms";

export const metadata: Metadata = { title: "Invitations and reminders" };

const CAPTION = "Settings · Invitations and reminders";
const BACK = `${SETTINGS}#invites`;

/**
 * Mockups: AdminSettingNumber, AdminSettingReminder, AdminSettingReturn.
 * Administrator users only (spec, "Settings").
 */
export default async function InvitationSettingPage({
	params,
}: {
	params: Promise<{ setting: string }>;
}) {
	const user = await requireRole(ACCESS.laptopsSettings);
	if (!canAccess(user.roles, ACCESS.management)) redirect(BACK);
	const { setting } = await params;
	const settings = await getServiceSettings();
	const parents = [LAPTOPS_SECTIONS.settings];

	if (isNumberSetting(setting)) {
		const definition = NUMBER_SETTINGS[setting];
		return (
			<LaptopsPage section="settings" parents={parents} narrow>
				<NumberForm
					action={saveNumberSettingAction.bind(null, setting)}
					initial={{ value: String(settings[definition.key]) }}
					title={definition.title}
					caption={CAPTION}
					hint={definition.hint}
					suffix={definition.suffix}
					inset={definition.inset}
					cancelHref={BACK}
				/>
			</LaptopsPage>
		);
	}

	if (setting === "reminders") {
		const today = londonToday();
		const first = await firstReminder(
			today,
			settings.firstReminderAfterDays,
			settings.reminderWeekday,
		);
		return (
			<LaptopsPage section="settings" parents={parents} narrow>
				<PageHeading caption={CAPTION} title="First reminder" />
				<p>
					When people who have not booked get their first reminder, and the day of the
					week reminders are sent after that.
				</p>
				<ReminderForm
					action={saveReminderAction}
					initial={{
						days: String(settings.firstReminderAfterDays),
						weekday: String(settings.reminderWeekday),
					}}
					example={`Reminders go out at 9:00am, at the same time as the morning invitations. A case gets its first reminder on the first ${WEEKDAYS[settings.reminderWeekday - 1]} after the number of days has passed (the next working day if that is a bank holiday), so with the saved settings someone invited on ${formatLongDate(today)} gets their first reminder on ${formatLongDate(first)}.`}
					cancelHref={BACK}
				/>
			</LaptopsPage>
		);
	}

	if (setting === "returns") {
		return (
			<LaptopsPage section="settings" parents={parents} narrow>
				<PageHeading caption={CAPTION} title="Old device return reminders" />
				<p>Weekly reminders to return the old laptop after a replacement is completed.</p>
				<ReturnRemindersForm
					action={saveReturnRemindersAction}
					initial={{
						enabled: settings.returnRemindersEnabled ? "yes" : "no",
						weekday: String(settings.returnReminderWeekday),
					}}
					cancelHref={BACK}
				/>
			</LaptopsPage>
		);
	}

	notFound();
}

/** The day the first reminder goes for someone invited today, as the 9:00am job decides it. */
async function firstReminder(today: IsoDate, days: number, weekday: number): Promise<IsoDate> {
	let holidays: IsoDate[] = [];
	try {
		holidays = await getBankHolidaysClient().englandAndWales();
	} catch {
		// Without the feed the example ignores bank holidays.
	}
	let day = addDays(today, days);
	while (!isWeeklySendDay(day, weekday, holidays)) day = addDays(day, 1);
	return day;
}

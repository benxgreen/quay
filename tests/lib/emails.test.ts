import { formatLongDate, formatTime } from "@/lib/dates/format";
import { fillVariables, findUnknownVariables, renderEmail } from "@/lib/emails/render";
import {
	LAPTOP_EMAIL_VARIABLE_NAMES,
	LAPTOP_EMAILS,
	type LaptopEmailCase,
	laptopEmailValues,
} from "@/services/replacements/laptops/lib/emails";

const ELLIE: LaptopEmailCase = {
	firstName: "Ellie",
	fullName: "Ellie Ward",
	caseReference: "LR-000128",
	type: "session",
	booking: { date: "2026-11-17", startTime: "09:30:00", location: "Civic Centre, Room 2" },
	bookingLink: "https://devices.services.bcpcouncil.gov.uk/my/replacements/laptop/rebook",
	oldSerial: "052318874406",
	software: ["Adobe Acrobat Pro", "Power BI"],
};

describe("formatLongDate and formatTime", () => {
	it("writes dates and times in GOV.UK style", () => {
		expect(formatLongDate("2026-11-17")).toBe("Tuesday 17 November");
		expect(formatLongDate("2026-11-08", { year: true })).toBe("Sunday 8 November 2026");
		expect(["09:30", "10:00:00", "12:00", "00:00", "23:59"].map(formatTime)).toEqual([
			"9:30am",
			"10am",
			"midday",
			"midnight",
			"11:59pm",
		]);
	});
});

describe("fillVariables", () => {
	const values = { first_name: "Ellie", date: undefined, team_name: "Desktop Infrastructure" };

	it("leaves a variable with no value blank when sending", () => {
		expect(fillVariables("Hi {first_name}, on {date}.", values, "send")).toBe("Hi Ellie, on .");
	});

	it("leaves a variable with no value as written in a test", () => {
		expect(fillVariables("Hi {first_name}, on {date}.", values, "test")).toBe(
			"Hi Ellie, on {date}.",
		);
	});

	it("leaves unknown names alone and never replaces inside a value", () => {
		expect(
			fillVariables("{frist_name} {first_name}", { first_name: "{team_name}" }, "send"),
		).toBe("{frist_name} {team_name}");
	});

	it("finds variables the service does not offer", () => {
		expect(
			findUnknownVariables(
				"{first_name} {frist_name} {frist_name}",
				LAPTOP_EMAIL_VARIABLE_NAMES,
			),
		).toEqual(["frist_name"]);
	});
});

describe("renderEmail", () => {
	const layoutHtml =
		'<title>Email from {team_name}</title><div class="preheader">{preheader}</div><main>{content}</main><footer>Email sent by {team_name}</footer>';

	it("fills the message and puts it in the portal email template", () => {
		const email = renderEmail({
			template: {
				subject: "Your session on {date} has been cancelled",
				preheader: "Your session on {date} is cancelled. Choose a new date.",
				bodyMarkdown: "Hello {first_name},\n\n[Choose a new date]({booking_link})",
			},
			layoutHtml,
			teamName: "Desktop Infrastructure",
			values: laptopEmailValues(ELLIE, "Desktop Infrastructure"),
			mode: "send",
		});

		expect(email.subject).toBe("Your session on Tuesday 17 November has been cancelled");
		expect(email.html).toContain("<title>Email from Desktop Infrastructure</title>");
		expect(email.html).toContain(
			'<div class="preheader">Your session on Tuesday 17 November is cancelled. Choose a new date.</div>',
		);
		expect(email.html).toContain(">Hello Ellie,</p>");
		expect(email.html).toContain('href="https://devices.services.bcpcouncil.gov.uk/my/');
		expect(email.text).toBe(
			"Hello Ellie,\n\nChoose a new date (https://devices.services.bcpcouncil.gov.uk/my/replacements/laptop/rebook)",
		);
	});

	it("escapes the preheader and team name in the template", () => {
		const email = renderEmail({
			template: { subject: "S", preheader: "<b>", bodyMarkdown: "Hi" },
			layoutHtml,
			teamName: "Tom & Jerry",
			values: {},
			mode: "send",
		});
		expect(email.html).toContain("&lt;b&gt;");
		expect(email.html).toContain("Email from Tom &amp; Jerry");
	});
});

describe("laptop email variables", () => {
	it("lists the mockup's variables and every email key", () => {
		expect(LAPTOP_EMAIL_VARIABLE_NAMES).toEqual([
			"first_name",
			"full_name",
			"case_reference",
			"type",
			"date",
			"time",
			"location",
			"booking_link",
			"old_serial",
			"team_name",
			"software_list",
		]);
		expect(LAPTOP_EMAILS.map((email) => email.key)).toEqual([
			"invitation",
			"booking_reminder",
			"booking_confirmed",
			"session_reminder",
			"session_cancelled",
			"rebook_needed",
			"availability_received",
			"device_issued",
			"return_reminder",
		]);
	});

	it("fills values from the case, with software as a bullet list", () => {
		expect(laptopEmailValues(ELLIE, "Desktop Infrastructure")).toMatchObject({
			date: "Tuesday 17 November",
			time: "9:30am",
			type: "session",
			software_list: "- Adobe Acrobat Pro\n- Power BI",
		});
	});

	it("has no booking values for an unbooked case", () => {
		const values = laptopEmailValues(
			{ ...ELLIE, booking: null, software: [] },
			"Desktop Infrastructure",
		);
		expect([values.date, values.time, values.location, values.software_list]).toEqual([
			undefined,
			undefined,
			undefined,
			undefined,
		]);
	});
});

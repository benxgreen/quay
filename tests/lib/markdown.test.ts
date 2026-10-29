import { EMAIL_STYLES, markdownToEmailHtml } from "@/lib/markdown/email-html";
import { parseMarkdown } from "@/lib/markdown/parse";
import { markdownToPlainText } from "@/lib/markdown/plain-text";

// The seeded "Session cancelled" message, filled for Ellie Ward as in the mockup.
const SESSION_CANCELLED = [
	"Hello Ellie,",
	"",
	"We are sorry, but we have had to cancel your laptop replacement session on **Tuesday 17 November at 9:30am**.",
	"",
	"## What you need to do",
	"",
	"- [Choose a new date](https://devices.services.bcpcouncil.gov.uk/my/replacements/laptop/rebook)",
	"- Keep using your current laptop until then",
	"",
	"Your software choices have been kept. We will send you a reminder each week until you book.",
	"",
	"Thank you,  ",
	"Desktop Infrastructure",
].join("\n");

describe("parseMarkdown", () => {
	it("joins lines into one paragraph and keeps a two-space line break", () => {
		expect(parseMarkdown("One\ntwo  \nthree")).toEqual([
			{
				type: "paragraph",
				content: [
					{ type: "text", text: "One two" },
					{ type: "break" },
					{ type: "text", text: "three" },
				],
			},
		]);
	});

	it("reads headings, bulleted and numbered lists", () => {
		const blocks = parseMarkdown("## Title\n- a\n- b\n\n3. c\n4. d");
		expect(blocks.map((block) => block.type)).toEqual(["heading", "list", "list"]);
		expect(blocks[2]).toMatchObject({ ordered: true, start: 3 });
	});

	it("reads Harbour's inset, warning and details blocks", () => {
		const blocks = parseMarkdown("^Inset^\n\n%Careful%\n\n~More help\nHidden **text**~");
		expect(blocks).toMatchObject([
			{ type: "inset", blocks: [{ type: "paragraph" }] },
			{ type: "warning", content: [{ type: "text", text: "Careful" }] },
			{ type: "details", summary: "More help", blocks: [{ type: "paragraph" }] },
		]);
	});

	it("keeps an unsafe link as text", () => {
		expect(parseMarkdown("[Click](javascript:void0)")[0]).toEqual({
			type: "paragraph",
			content: [{ type: "text", text: "Click" }],
		});
	});
});

describe("markdownToEmailHtml", () => {
	it("matches the mockup's HTML sent to the webhook", () => {
		const p = `<p style="${EMAIL_STYLES.p}">`;
		const li = `<li style="${EMAIL_STYLES.li}">`;
		expect(markdownToEmailHtml(SESSION_CANCELLED)).toBe(
			[
				`${p}Hello Ellie,</p>`,
				`${p}We are sorry, but we have had to cancel your laptop replacement session on <strong>Tuesday 17 November at 9:30am</strong>.</p>`,
				`<h2 style="${EMAIL_STYLES.heading}">What you need to do</h2>`,
				"<ul>",
				`${li}<a href="https://devices.services.bcpcouncil.gov.uk/my/replacements/laptop/rebook" style="${EMAIL_STYLES.a}">Choose a new date</a></li>`,
				`${li}Keep using your current laptop until then</li>`,
				"</ul>",
				`${p}Your software choices have been kept. We will send you a reminder each week until you book.</p>`,
				`${p}Thank you,<br>Desktop Infrastructure</p>`,
			].join("\n"),
		);
	});

	it("uses the mockup's exact inline styles", () => {
		expect(EMAIL_STYLES.p).toBe(
			"font-size: 16px; font-family: Helvetica, Arial, system-ui, sans-serif; font-weight: 400; color: #0b0c0c; margin: 0 0 20px 0; line-height: 26px; mso-line-height-rule: exactly;",
		);
		expect(EMAIL_STYLES.heading).toBe(
			"font-size: 20px; font-weight: 600; font-family: Helvetica, Arial, system-ui, sans-serif; color: #361e54; margin: 15px 0; line-height: 28px; mso-line-height-rule: exactly;",
		);
	});

	it("escapes HTML in the message", () => {
		expect(markdownToEmailHtml("<b>Tom & Jerry</b>")).toContain(
			"&lt;b&gt;Tom &amp; Jerry&lt;/b&gt;",
		);
	});
});

describe("markdownToPlainText", () => {
	it("makes the plain-text version from the same Markdown", () => {
		expect(markdownToPlainText(SESSION_CANCELLED)).toBe(
			[
				"Hello Ellie,",
				"",
				"We are sorry, but we have had to cancel your laptop replacement session on Tuesday 17 November at 9:30am.",
				"",
				"What you need to do",
				"",
				"- Choose a new date (https://devices.services.bcpcouncil.gov.uk/my/replacements/laptop/rebook)",
				"- Keep using your current laptop until then",
				"",
				"Your software choices have been kept. We will send you a reminder each week until you book.",
				"",
				"Thank you,",
				"Desktop Infrastructure",
			].join("\n"),
		);
	});
});

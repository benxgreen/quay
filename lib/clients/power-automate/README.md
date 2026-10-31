# Power Automate client

The portal's one way of telling Power Automate that something happened. The portal sends everything it knows in the same envelope every time, and the **flow decides what to do**: send an email, post to Teams, update a list. No logic or templates live here that belong in a flow, and a flow can start using a field without a change to the portal.

Server only (`import "server-only"`). Webhook URLs come from `portal.connections` (Settings › Connections); there are no secrets.

## What's exported

| Export | What it is |
|---|---|
| `getPowerAutomateClient()` | The client to use. The mock unless `WEBHOOK_CLIENT=http` (falls back to `EMAIL_CLIENT`). |
| `PowerAutomateClient` | `post(connection, event, context)`: posts one event to the webhook saved under `connection`. |
| `WebhookEvent` | What you pass in: what happened. |
| `WebhookPayload` | What is actually posted: your event plus the envelope. |
| `WebhookEmail` | A rendered email, for events of type `"email"`. |
| `toWebhookPayload(event, context)` | Wraps an event in the envelope, for tests or showing a sample. |
| `SCHEMA_VERSION` | The envelope's version (1). Bump it if a field is renamed or removed. |
| `createHttpPowerAutomateClient()`, `createMockPowerAutomateClient()` | The two implementations, for tests. |
| `mockWebhookPosts()` | What the mock has "posted" since the server started, newest last. |

## Sending an event

```ts
import { getPowerAutomateClient } from "@/lib/clients/power-automate";

await getPowerAutomateClient().post(
	"notification_webhook",
	{
		type: "booking.rebooked",
		service: "laptop_replacements",
		case: { reference: "LR-000160", url: portalUrl("/manage/replacements/laptops/cases/LR-000160") },
		person: { name: "Ellie Ward", email: "ellie.ward@bcpcouncil.gov.uk" },
		data: { from: { date: "2026-11-17", time: "10:00am" }, to: { date: "2026-11-24", time: "10:00am" } },
	},
	{ trigger: { kind: "user", label: "Rebook", actorUserId: user.id }, service: "laptop_replacements" },
);
```

Every call is written to the Connection log (`callExternal`). A failure throws `ExternalCallError` (or `ConnectionNotConfiguredError` when no URL is saved), so the caller decides: an action that must not happen without the call shows the Failed banner and saves nothing; a "nice to know" post catches it and carries on.

Emails don't call this directly: use `sendEmail` (`lib/emails/send.ts`), which renders the email and posts it through `lib/clients/email` as an `"email"` event, with the variables in `data`.

## What the flow receives

```json
{
	"schema_version": 1,
	"id": "6f1c…",                     // unique per post: ignore a repeat
	"sent_at": "2026-11-02T09:00:01.123Z",
	"environment": "production",      // PORTAL_ENVIRONMENT, else NODE_ENV
	"portal_url": "https://…",
	"triggered_by": { "kind": "user", "label": "Rebook", "user_id": "42" },
	"type": "booking.rebooked",
	"service": "laptop_replacements",
	"case": { "reference": "LR-000160", "url": "https://…" },
	"person": { "name": "Ellie Ward", "email": "ellie.ward@…" },
	"email": { … },                   // only for type "email": template, to, from_name, from, subject, preheader, html, text
	"data": { … }                     // anything else
}
```

`triggered_by.kind` is `user`, `schedule` (the 9am jobs) or `system`.

## Working with it in Power Automate

1. Start the flow with **When an HTTP request is received**. Paste a sample payload (above, or from `toWebhookPayload`) into "Use sample payload to generate schema".
2. Copy the flow's URL into Settings › Connections in the portal (`email_webhook` for emails, `notification_webhook` for everything else).
3. Branch on `type` with a **Switch**. Check `environment` if a test portal shares a flow.
4. Reply with a 2xx quickly. Anything else counts as failed: the portal tries three times (waiting 1s, then 2s) within 30 seconds and logs the result.
5. A retry can repeat a post that actually arrived, so use `id` to ignore duplicates where it matters.

## Developing

- `WEBHOOK_CLIENT=mock` (the default) keeps posts in memory and logs them like real calls; `mockWebhookPosts()` and `mockOutbox()` (emails) show them.
- `MOCK_FAILURES=email_webhook,notification_webhook` makes the mock fail, to see the Failed banner.
- Adding a field: add it to `WebhookEvent` (optional) or `data`. Renaming or removing one breaks flows: bump `SCHEMA_VERSION` and tell whoever owns them.
- The notification library (to do, `docs/gaps-and-next-steps.md`) will sit on top of this, saving a notification in the portal and posting the event.

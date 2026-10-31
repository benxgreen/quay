# Gaps and next steps

Reviewed 30 October 2026, after stages 1–13 of the build plan. Laptop replacements is complete against mock Halo and Power Automate. What follows is what stands between it and live use, and what to tidy before a second service.

## 1. Blocked on information from Ben (open questions in CLAUDE.md)

These are built behind mock clients and wait on details, not code.

| Gap | Where | Needs |
|---|---|---|
| Laptop replacements' Halo calls are mock only; `HALO_CLIENT=http` is refused for them | `services/replacements/laptops/lib/halo` | End-of-life and stock report IDs, stock criteria, status IDs and fields for the completion update, what "returned" and decommission send (`lib/clients/halo/TODO.md`) |
| Halo custom fields on users and assets aren't mapped | `lib/clients/halo/users.ts`, laptop Halo types | API access to list them |
| BCP username field, job title, "Department" vs "Service area", manager | `lib/clients/halo/users.ts` | Confirm against the real API |
| "Open in Halo" links on Needs attention and the user dialog | Import pages | Halo's web address format for assets and users |
| Whether the old device's Halo status changes when marked returned | `steps.ts` | Decision |
| Whether removing a device from a case needs a reason (it's optional now) | `steps.ts` | Decision |
| Halo API scopes (`HALO_SCOPE=all` until agreed) | `.env` | Agreement with the Halo admins |
| Entra ID app registration (development sign-in until then) | `lib/auth` | Security team |
| The other eight email templates are placeholders ("[Wording to come]") | Settings › Emails | Final wording (the editor is ready) |

## 2. Not built yet

| Gap | Notes |
|---|---|
| **Stage 14: hosting and observability** | No `.deployment` file, App Service settings or Application Insights yet. Needs: the App Service and PostgreSQL Flexible Server, PgBouncer, `db/setup` and migrations per environment, App Insights (or GlitchTip), and the 9:00am timer calling `POST /api/replacements/laptops/jobs` with `JOBS_SECRET`. |
| Manager views of direct reports on `/my` | Needs the manager field from Halo. |
| Error and not-found pages | No `app/error.tsx`, `app/global-error.tsx` or `app/not-found.tsx`, so errors show Next.js's defaults. Add GOV.UK-style "Sorry, there is a problem with the service" and "Page not found" pages, which also report to App Insights. |
| Cookies page | Still a placeholder. Privacy and accessibility statement pages are not written. |
| **Notification library** (to do) | One portal-wide `lib/notifications` that records what happened and tells Power Automate: e.g. when someone rebooks, `notify({ type: "booking.rebooked", service, case, person, data: { old, new } })` writes a notification row in the portal (a new `portal.notifications` table, shown to the team, with read/unread) and posts the event to the `notification_webhook` connection through `lib/clients/power-automate`, which already sends the shared envelope. Decide: which events notify (rebook, cancel, did not attend, availability request, flags…), who sees them in the portal, whether a failed post is retried or only logged (it shouldn't block the action, like the session-cancelled emails), and the event type names, which flows will key on. |
| Smartphone replacements and new starters | Placeholder pages only; `sr.settings` is the only table. |

## 3. Tests and stories to catch up

Typecheck and lint pass, but no automated tests were added from stage 9 onwards (they were paused), and the existing suites haven't been run since. Before going further:

- Run `npm test` and fix anything that has drifted.
- Add tests for: booking and rebooking (`booking.ts`), the scheduled jobs and their idempotency (`jobs`), the bookings dashboard queries, settings changes and moves (`settings.ts`), email checks and test sends (`lib/emails/validate.ts`, `lib/emails/send.ts`), statistics, `lib/auth/signed-id.ts`, `lib/utils/csv.ts` and `lib/utils/text.ts`.
- Add Storybook stories for `settings-form`, `email-editor` and `booking-review`, so the a11y addon checks them.
- With no CI (deploys are manual), make `npm run typecheck && npm run lint && npm test` the check before every deploy.

## 4. Before a second service

Done on 30 October 2026: the job log and connection log moved to `portal` with a `service` column (migration 0021), and the job runner to `lib/jobs/runner.ts`. Connections stay in laptop replacements' Settings, as they are its connections. The journal stays per service (`lr.journal_entries`), shown with the shared `Journal` pattern.

## 5. Smaller things noticed

- The Statistics stock tile shows "–" until the Stock page has loaded the Halo stock list once; a scheduled stock refresh (the old "Scheduled stock refresh" call in the mockups) would keep it current.
- The development database counts in `db/README.md` ("19 people", "16 cases") should be checked against the seed when it next changes.
- An Administrator needs the laptops admin role as well to change Invitations and reminders or Connections, because Settings sits inside laptop replacements. Connections stay in laptop replacements' Settings by decision.

## Suggested order

1. Run the test suite and add the missing tests and stories (section 3).
2. Error and not-found pages, and the cookies, privacy and accessibility pages.
3. Stage 14: an App Service test environment, App Insights, the job timer, and a deploy checklist.
4. Wire in the real Halo calls and Entra ID as their details arrive.

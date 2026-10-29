# Laptop Replacement – Service Specification

Oct 25, 2026 · @Ben

## Purpose and scope

Laptop replacement becomes a service inside the existing Device portal, replacing the replacement workbook, Power Automate-driven workflow and manual email handling. It uses the portal's existing sign-in, roles, layout and journal; this spec covers only what the replacement service adds. The existing process defines the requirements; the portal becomes the single source of truth for every replacement case, session, booking and device allocation.

In scope:

- Importing end-of-life devices from a HaloITSM report, with devices already in the workflow or replaced before (including historical completions) filtered out
- The team choosing each case's method (Collection or Session) before invitation
- Sending invitations from a queue, at most 15 each working day, and chasing non-responders
- Self-service booking and rebooking of a replacement, plus manual bookings by the team
- Capturing required business software from a simple managed list, and recording what engineers prepared
- Managing session dates, times, methods and capacity, with adjustable defaults
- A live stock list of available replacement devices from Halo, allocated to cases from within the case
- An engineer dashboard of bookings by day, week and month, with print
- Completion that updates the new device in Halo, with the case kept open until the old device is returned and decommissioned
- A journal of every change and every email sent on a case

Out of scope: HaloITSM stays the ITSM system and asset register; no Halo tickets are raised. Email delivery stays in Power Automate, called by webhook. Smartphone replacements, New Starters and Inactive Audit are separate services in the same portal.

## What the new system must fix

The workbook holds one row per person at a time, so history is overwritten and device allocations are lost when someone cancels and rebooks.

| Today | Problem | In the Device portal |
| --- | --- | --- |
| One booking row per person, overwritten on rebook | Lose sight of which box number was allocated to the previous booking | Every booking is its own record; the box number sits on the case, so rebooking never touches it |
| Box number held on the booking row | No record of where a device went | Allocating and removing a box number are journal entries on the case; the stock list shows which case each device is allocated to |
| Import rows added by hand | Risk of inviting the same device twice | Import from a Halo report; devices already in the workflow or replaced before are hidden |
| Invitations sent in one batch | Team overwhelmed by replies and bookings | Queue sends at most 15 invitations each working day |
| Session dates edited in a list by hand | Full sessions stay visible until someone removes them | Capacity enforced at booking time; full sessions hidden automatically |
| Software requirements via a separate form | Can change at any time, including the day before | Edited in the portal, locked 3 working days before the session |
| Status kept in step by a 15-minute reconciliation flow | Workflow and bookings drift apart | One data model; status changes in one place, so no reconciliation |
| History sheet written by flows | Partial and hard to read; no record of which emails went out | Journal entry for every change and every email, by every actor |

## Data model

The replacement case is the anchor: one case per person per end-of-life device, owning many bookings, many journal entries and its allocated replacement device. Allocations hang off the case, not the booking, as a single box number; allocating and removing it are both journal entries, so the team can always see where a device went.

Relationships: Case 1–many Booking · Session 1–many Booking · Case 1–many Journal entry. Case 1–many Case check (the case's own copy of each checklist, taken when it reaches that step). The stock list is read live from Halo and not stored. The software list and session defaults are service settings. So are the device preparation checks and the decommission checklist.

### Replacement case

| Field | Type | Notes |
| --- | --- | --- |
| Case reference | Text, auto | e.g. LR-000123, shown in emails |
| User | Lookup to portal user | The person the case is for, used as the case name everywhere. This is the person the device is listed against in the portal, which isn't necessarily the Halo device allocation. Usually it is the Halo assigned user; when someone else is receiving the laptop, it is that person. The Halo assigned user is also stored on the case for reference |
| Old device asset ID | Text | HaloITSM asset ID from the import report |
| Old device serial and hostname | Text | From Halo at import; serial shown in emails |
| Method | Choice: Collection, Session | Chosen by the team when queuing; decides which sessions the user can book and is named in the invitation |
| Status | Choice | See Case lifecycle |
| Box number | Text, optional | Asset ID of the allocated replacement device, chosen from the stock dropdown; cleared when unallocated |
| Software prepared | JSON array of names | Ticked by the engineer on the case |
| Queued on | Date and time | Sets the invitation queue order |
| Invited on | Date and time | Reminders start 21 days after this |
| Reminders sent | Whole number |  |
| Last reminder on | Date and time | Drives the weekly cadence |
| Flagged | Yes/No | Set automatically when the 3rd reminder is sent (the Flag case after setting, default 3), or by a team member with a reason while the case is not yet booked (Queued, Pending or Rebook required); cleared by the team. Stored with flag reason, flagged by and flagged on (System for automatic flags) |
| Rebook requested on | Date and time | Set when the team marks a booking cancelled, missed or unsuccessful |
| Attended on | Date and time | Set when the booking is marked Attended |
| Old device returned | Yes/No + date + recorded by | Manual and one-time; updates Halo and moves the case to Awaiting decommission |
| Return reminders | Yes/No | Default Yes. The team can untick it on step 5 to stop weekly return reminder emails |
| Decommissioned on | Date and time + by | Set when the decommission hook succeeds; the case becomes Completed |
| Completed on | Date and time |  |
| Booking token | Text, secret | Signs the link in emails |
| Closed on | Date and time | Set when the case becomes Completed or Withdrawn. Archiving is worked out from this date (one month) |
| Withdrawn reason | Text | Required when withdrawing; shown in the journal, never to the user |

### Session

| Field | Type | Notes |
| --- | --- | --- |
| Method | Choice: Collection, Session | Shown as a coloured tag everywhere a session appears |
| Date | Date | GOV.UK date input |
| Start time | Time | Hour and minute inputs, 24-hour |
| Capacity | Whole number, 1 or more | Pre-filled from the method's default, editable |
| Location | Text | Pre-filled from the method's default, editable |
| Status | Choice: Open, Full, Closed, Cancelled | Full derived from active bookings vs capacity |
| Active bookings | Calculated | Count of bookings with status Booked |

### Session defaults (service setting)

One row per method, edited on the settings page. A new session takes these values when the method is chosen; any value can then be changed for that session, and changing a default never alters existing sessions.

| Method | Default start time | Default capacity | Default location |
| --- | --- | --- | --- |
| Collection | e.g. 10:00 | e.g. 10 | Room 310, BCP Council Civic Centre, Bournemouth |
| Session | e.g. 09:30 | e.g. 5 | Room 310, BCP Council Civic Centre, Bournemouth |

### Booking

| Field | Type | Notes |
| --- | --- | --- |
| Case | Lookup |  |
| Session | Lookup | Must match the case's method |
| Status | Choice: Booked, Rebooked, Cancelled, Did not attend, Unsuccessful, Attended | Only one Booked per case; Cancelled is set by the team only |
| Software requested | JSON array of names | e.g. `["ArcGIS Pro", "Adobe Acrobat Pro"]` |
| Software last changed | Date and time |  |
| Booked by | User or self | Shows manual bookings made by the team |
| Replaces booking | Lookup to Booking, optional | Set when this booking came from a rebook |
| Reason | Text, optional | For cancelled, did not attend or unsuccessful |

A booking is either a place on a published session or a custom appointment: a date, time and location agreed with the person, which uses no session place and is not tied to a session. Custom appointments show on the Bookings views with a "Custom appointment" label, can be filtered on, and get the same confirmation and reminder emails.

### Previous replacement

Devices replaced before the portal, imported from the old workbook's completions (asset ID, serial, completed date). Used only by the import screen's "replaced before" check, alongside the portal's own completed cases.

### Software list (service setting)

A plain ordered list of application names, edited by the team, rendered as checkboxes on the booking form and on the case's "Software prepared" section. Bookings and cases store names, so editing the list never changes existing records.

### Checklists (service setting)

Two ordered lists edited in Settings: device preparation checks (step 2) and the decommission checklist (step 6). Each item has an ID, its list, its wording, its order and an active flag. Items are never deleted: removing one marks it inactive so it is left out of future copies, and editing the wording only affects future copies.

### Case check

The case's own copy of a checklist. When a case reaches step 2 or step 6, the active items of that checklist are copied onto the case, and from then on the case only reads its copy. Changing Settings never alters a step that has started or finished, or an archived case.

| Field | Type | Notes |
| --- | --- | --- |
| Case | Lookup |  |
| Step | Choice: Device preparation, Decommission |  |
| Checklist item | Lookup, optional | For reference only; the case keeps working if the item is later removed |
| Label | Text | The wording as copied, so the record stays correct if Settings changes |
| Order | Whole number | As copied |
| Ticked | Yes/No | Saved with the step's save button, not on click |
| Ticked by and on | User + date and time | Shown on the step and in the archived record |

### Journal entry

The portal's existing journal, written against the case.

| Field | Type | Notes |
| --- | --- | --- |
| Case | Lookup |  |
| When | Date and time |  |
| Actor | User or System (job name) |  |
| Event type | Choice | e.g. Invited, Email sent, Booked, Rebooked, Software changed, Software prepared, Device allocated, Device removed, Preparation checks saved, Replacement completed, Old device returned, Return reminders changed, Checklist updated, Decommissioned, Withdrawn, Note |
| Summary | Text | Line shown on the case timeline; free text for team notes |
| Detail | JSON | Before and after values; for emails, the event name and webhook result |

## Case lifecycle

The case status is the single workflow state; bookings and allocations have their own statuses but never contradict it, because every change goes through the same service layer.

_(Lifecycle diagram omitted from the export; the status table below covers the same states.)_

Rebooking keeps the case Booked: the old booking is marked Rebooked and a new one is created. Users cannot cancel; only the team can cancel a booking. A case that has had 3 reminders is Flagged for the team but keeps its status and keeps receiving weekly reminders until it is booked or withdrawn. There is no time limit on booking. An admin can move any open case to Withdrawn with a reason. Completed and Withdrawn cases are archived one month after they close (see Cases).

**Cannot attend any session.** Under the dates on the booking page, colleagues who work non-standard days or hours can follow "tell us when you are available". They give a reason (non-standard days or hours, away for all of the dates offered, or something else) and when they are usually available. Sending it moves the case to Unbooked, flags it "Unavailable for sessions", pauses reminders and writes the request to the journal. The team corresponds with the person outside the system and records what is agreed as journal notes. They then book a custom appointment: a date, time and location that is not tied to a published session and uses no session place, with an optional note added to the confirmation email. The person gets the same confirmation and reminder emails and chooses software from the link in the email until the software lock. Alternatively the team books a published session on their behalf, or resends the invitation to return the case to Pending. The flag shows in the Cases list and on the case; no separate alert is sent.

**Not available when changing a booking.** The "Choose a new date and time" page ends with an "or" option, "I am not available for any of these dates". Choosing it cancels the current booking and moves the case to Unbooked. It is not flagged: weekly booking reminders continue until the person books again, and their portal home shows an Important banner saying the session was cancelled, above the "You need to replace your laptop" panel. Their software choices are kept.

**Session cancelled by the team.** The session page has a red "Cancel this session" button that leads to a confirmation page with an optional reason. Confirming:

- marks every booking on the session Cancelled and moves each case to Rebook required
- emails each person with the "Session cancelled" email and a link to choose a new date (the reason is not included)
- restarts weekly booking reminders
- keeps allocated devices and software choices on the cases; sets the session to Cancelled with the reason, who cancelled it and when, so it drops out of upcoming sessions and stays viewable under the Cancelled status filter; and writes the reason to each affected case's journal

The colleague's portal home shows an Important banner saying the session was cancelled, with a "Choose a new date" button.

**Email templates.** Each service's Settings has an Emails section with the service's team name (Desktop Infrastructure for laptop replacements), the mailbox its emails are sent from (desktopinfrastructure@bcpcouncil.gov.uk for laptops; ictgc@bcpcouncil.gov.uk for Governance & Compliance's smartphone replacements), a link to the portal email template, and every email the service sends: invitation, booking reminder, booking confirmation, session reminder, session cancelled, rebook needed, availability request received, device issued and old device return reminder. Each email has its own page with a tag saying whether its timing is Automatic (sent when something happens) or controlled by a Setting, an editable subject and preheader, and a Markdown message using variables such as {first\_name}, {date}, {time}, {location}, {booking\_link} and {team\_name}, all listed on the page. The variables are a fixed list in code (services/replacements/laptops/lib/emails), which names each one and where its value comes from; adding a variable is a code change, and it then appears on the page automatically. A live preview shows the email inside the portal email template. "Send a test to me" sends it to the person editing; a variable with no value is sent as written, for example {date}. The portal email template (Portal settings) is the full HTML used for every email in the portal: {content} marks where the message goes, {preheader} the hidden preview text and {team\_name} the team in the footer. Editing a template only affects emails sent afterwards. The portal renders the final subject and HTML and posts them to the one Power Automate flow, which only sends.

| Status | Meaning | Leaves when |
| --- | --- | --- |
| Queued | Imported from the Halo report with a method chosen, waiting for invitation | Picked up by the invitation job (max 15 each working day) |
| Pending | Invited, no booking yet; weekly reminders running | Books (weekly reminders continue until then) |
| Unbooked | The person has told us they cannot attend any published session (for example, non-standard working days). Flagged "Unavailable for sessions"; reminders paused | The team books a custom appointment or a published session (to Booked), or resends the invitation (back to Pending, flag cleared, reminders restart) |
| Booked | Has one active booking | Attended, or the team marks the booking cancelled, did not attend or unsuccessful |
| Rebook required | Previous booking failed; weekly rebook reminders running | Rebooks (weekly reminders continue until then) |
| Awaiting return | Attended; new device set to In Service in Halo; old device not yet back | Team marks the old device returned (one-time, updates Halo) |
| Awaiting decommission | Old device back with the team; decommission checklist not yet complete | Every decommission check is ticked and the decommission hook succeeds |
| Completed | New device issued, old device returned and decommissioned | Final |
| Withdrawn | Removed by an admin with a reason; any booking is cancelled, an allocated device goes back to stock and nothing is sent to the person | Final |

## User journey

Colleagues manage their replacement from a "Your laptop replacement" page in the Device portal, reached from the email link or from the portal home. The team sets the method in advance, so the invitation already says whether it is a Collection or a Session, and the user only ever sees dates for that method.

### Book replacement

1. **Book replacement** – start page: the portal home shows "You need to replace your laptop" with the device serial number, what the chosen method involves and a "Book your laptop replacement" button.
2. **Choose a date and time** – radios grouped by week for the case's method only, each showing date, start time, location and places left. Closed and past sessions are hidden, and so are sessions 5 or fewer working days away (the booking lead time setting). The page doesn't mention the lead time; the dates just aren't offered. Under the dates, "If you cannot attend any of these dates" leads to "tell us when you are available".
3. **What software do you need?** – one checkbox per name on the software list, each with its hint, plus "Other software": one text box per program with "Add another". Colleague-facing pages always say "software", never "business applications", because the list covers productivity and business software.
4. **Check your answers** – summary list with Change links.
5. **Confirmation** – the "Your laptop replacement" page with a green "Booking confirmed" success banner; the confirmation email is sent. Colleagues never see the case reference.

Capacity is checked in real time and again on submission. While the person is choosing, places left update live and a session that fills shows as Full and can no longer be chosen. If the session they chose fills before they continue, they return to the dates with "\[Date and time\] is now full. Choose another date" in the error summary and above the dates. The check runs once more when the booking is confirmed.

### Manage a booking

| Action | Available | What happens |
| --- | --- | --- |
| Change software | Until 3 working days before the session | New array saved; journal entry |
| Rebook | Until the session starts | Choose a new date for the same method; old booking marked Rebooked, new booking created; software carried over; journal records the date change; user and team notified |

There is no cancel option for users: if a date no longer works, they rebook, or choose "I am not available for any of these dates". Inside the lock window the software section reads: "Your new laptop is being prepared, so you can no longer change your software here. If something is missing, the engineer can help at your session."

### Access

- Uses the Device portal's existing Entra ID sign-in; the case is matched on the signed-in user, never on the link alone
- The email link carries a signed case token to deep-link to the right case
- A person with no open case sees "You do not have a laptop replacement due"

## Management interface

The replacement service adds seven areas to its service navigation: Bookings, Sessions, Cases, Stock, Statistics, Import and Settings, in that order. All follow GOV.UK Design System patterns. Every team page has a GOV.UK-style "Menu" button with a chevron in the header, opening Services (Laptop replacements, Smartphone replacements, New starters) and Management (Users, Portal settings). The page heading's main action sits under the title, not beside it. List pages use one of two filtering patterns, both in use: a search box with a "Show filters" panel (Cases, Import, Bookings, Stock) or a filter sidebar (Sessions). Long lists use a secondary "Show more" button (it is an action, so a button rather than a link) next to a "Showing X of Y" line, instead of pagination: the next batch is fetched client-side and appended, the count ("Showing 20 of 41") is announced to screen readers, and focus moves to the first new row. Hidden laptops on the import screen give their reason as a plain sentence, not a tag. Team pages use a 1260px container with 60px padding each side (20px on phones). Where a page has a side panel, the main column is at most 720px and the panel up to 320px, and the panel only shows when it has something to act on. Any action that sends an email or can't be undone opens its own confirmation page: the question as the heading, what will happen, the action button and a "Go back" link. Destructive actions use the red warning button. Changes made by the team land on a page with a green success banner; a failed call to Halo, the decommission hook or Power Automate shows a red "Failed" banner instead (see External calls first).

### Telling the methods apart

Collection and Session run differently on the day, so the method is visible wherever a session, booking or case appears:

- A tag on every row and heading where it adds information; in running text the type is plain words, never a tag: blue "Collection", purple "Session" (colour plus the word, never colour alone)
- A method filter on every list (All, Collection, Session), remembered per user
- Dashboard and session lists grouped by session, with the tag in the group heading
- Counts split by method in summaries, e.g. "Today: 2 Collection (14 of 20), 1 Session (5 of 5)"

### Bookings dashboard

The engineers' view of who is coming in.

- Search bookings (name, case reference or software) and a "Show filters" panel: View (Day, Week, Month, All bookings), Type, Booking (all, published sessions or custom appointments), Device unprepared and Software not prepared, plus Include past bookings on All bookings
- Day view grouped by session: method tag, time, location, booked of capacity and a link to the session, then per attendee name, case reference, box number, device hostname, software requested, and separate Device and Software prepared tags; Previous, Today and Next links
- Week view lists each day's sessions and custom appointments with booked and devices prepared; Month view is a calendar of sessions (cancelled ones struck through) linking to the day
- All bookings lists every upcoming booking earliest first, with names opening the case in a new tab
- "Print this view" with a print stylesheet that drops the navigation and starts each session on a new block
- Bookings from past days still marked Booked show a note at the top; "Review them" opens a modal to work through them, each linking to its case

### Import

The team chooses which end-of-life devices enter the workflow and how each will be replaced.

1. The page calls the Halo report through the API ("Refresh from Halo", with the time it last updated) and lists eligible laptops: serial, hostname and asset ID, the assigned user and their email, model, purchase date and last seen.
2. A search box (name, email, serial, hostname or asset ID) and a "Show filters" panel: sort by purchase date (oldest first by default, or newest first), last seen or assigned user, and Model checkboxes built from the models in the latest report, each with a count.
3. In the background each device is checked. Devices with an open case, a completed case or a previous replacement record are hidden; a summary line shows how many and why, and "See hidden laptops" lists each with its reason as a sentence.
4. The team ticks devices (with "Select all"), chooses the type for the selection (Collection or Session) and selects "Add to invitation queue". Each becomes a Queued case, and the page shows a success banner listing the new cases, their place in the queue and the estimated invitation date. Laptops with no assigned user in Halo, or whose user is not in the staff directory or has a disabled Microsoft account, are not listed here: they go on the Needs attention tab with the reason in a sentence and a link to Halo, and move to Eligible devices once fixed and refreshed. Each row can also show the user's Last sign in date (their Microsoft sign-in, from Entra ID via Microsoft Graph) and an information button that opens a modal dialog (focus moves into it, Escape or Close returns focus to the button) with the user's details and every device assigned to them in Halo with its last seen date, so the team can spot a shared or spare laptop before importing it.

The Import page has three secondary navigation links: Eligible devices, Needs attention and Invitation queue. The queue lists Queued cases as one list in invitation order, each row showing its type tag and an estimated invitation date based on the daily limit; estimates update when the limit changes or cases move. The team can move a case to the front, remove it (which withdraws it, and the laptop shows on Eligible devices again) or change its type: Change type opens its own page (Collection or Session) and returns to the queue with a success banner, and the case keeps its place. A search box above the queue finds cases by name, email, serial, hostname or case reference; results keep their place number in the queue. Adding a case manually with "Add to the invitation queue" also lands here with a success banner.

Completed replacements from the old workbook (asset ID, serial, completed date) are loaded straight into the database for the replaced-before check; there is no import page for them.

### Sessions

List view: sessions with date, time, method tag, location, booked of capacity (with a bar) and a status tag (Open, Full, Closed, Cancelled), filtered from a sidebar by Upcoming or Past, month, type and status.

Add or edit a session:

| Field | Component | Validation |
| --- | --- | --- |
| Method | Radios: Collection, Session (asked first) | Required |
| Date | GOV.UK date input (Day, Month, Year) | Real date, not in the past |
| Start time | Hour and Minute text inputs, `inputmode="numeric"`, in a fieldset like the date input | Hour 0–23, minute 0–59 |
| Capacity | Text input, `inputmode="numeric"`, width-2 | Whole number, 1 or more; not below current bookings |
| Location | Text input | Required |

Choosing the method pre-fills start time, capacity and location from that method's defaults; every field stays editable, and the session can be edited later. Sessions are added one at a time, with no repeat option, so the team controls exactly which dates are offered. The hour-and-minute fieldset is used because the Design System has no time component and native time pickers behave inconsistently with assistive technology.

Session page: the date and time with type and status tags, "Print attendee list" and "Edit session" under the heading, then location, booked, devices prepared and software prepared, and the attendee list with case, box number, hostname, software requested and Device and Software prepared tags. Attendance is recorded on each case (Complete replacement, or Record did not attend or unsuccessful). A red "Cancel this session" button opens the confirmation page with an optional internal reason. A cancelled session opens read-only: who cancelled it and when, the reason (internal only, never in emails), and the people who were booked, with when their Session cancelled email went and where each case is now.

### Cases

Searchable list of cases: name and case reference, old device, type, status (with "Step X of 6" for open cases, and the flag and its reason underneath), session and box number. Search by name, email, serial, hostname or case reference. A "Show filters" panel holds sort (next session date, name, date added or status), status (including Awaiting return and Awaiting decommission), type, Flagged only, No device allocated, Include archived cases, and a Columns choice (name always shown; old device, type, status, session, box number, software requested, email, department, date added and last reminder), remembered per user. Applied filters show as removable chips above the list. The case page has:

- **Header** – the case reference as a caption, the person's name, status and type tags, and the flag if raised.
- **Details** – email, then username, job title and department (from the staff directory, read-only), type, booking, software requested and old device. Type, booking, software requested and old device have Change links while the case still has booking actions (up to the replacement being completed); changing the booking books on the person's behalf.
- **Replacement steps** – six numbered steps, each with Show/Hide and a status (Done, Current step or Not started), plus "Show all steps". Each step unlocks only when the one before is done. 1 Replacement device: a dropdown of available devices from the stock list (GOV.UK select with accessible autocomplete, searching by box number, serial or hostname) and Allocate; once allocated it shows the box number, serial and hostname and an "Unallocate device" button that returns it to stock. A device can be allocated before the person books. 2 Device preparation: the case's copy of the preparation checks, such as changing the primary user in Intune and installing updates, then "Confirm device prepared". 3 Software prepared: only the applications the person requested, each ticked as it is installed, then "Confirm software prepared". 4 Complete replacement: a warning that Halo will be updated, then "Complete replacement" (one-time), which records attendance and runs the Halo completion update. 5 Old device returned: a "Send reminder emails" checkbox (weekly on Mondays until returned) and "Mark old device as returned" (one-time, updates Halo). 6 Old device decommissioned: the case's copy of the decommission checklist, then "Decommission old device", which runs the decommission hook and closes the case as Completed.
- **Saving checklists** – ticks are not saved as they are clicked. Each checklist has a secondary save button ("Save preparation checks", "Save software", "Save decommission checks"), and the primary button saves and moves the case on once every item is ticked. Unsaved ticks show "You have unsaved changes" and leaving the page with them shows a warning. Each save writes one journal entry listing what changed, and the step shows who saved it and when. The return reminder setting on step 5 has its own "Save reminder setting" button.
- **Checklist changes** – a case copies a checklist when it reaches that step, so editing Settings never changes a step that has started or finished, or an archived case. If Settings changes while a case is on that step, the step shows "The checklist has changed in Settings since this step started" with an "Update to latest list" link. Updating keeps ticks on items that still exist, adds new items unticked, drops removed items and writes a journal entry.
- **Bookings** – history, including rebooked and cancelled bookings.
- **Journal** – timeline, newest first, including every email sent, with "Add a note".
- **Actions panel** – beside the main column, shown only while there are actions to take. Up to the replacement being completed it offers Resend booking details, Resend invitation, Cancel booking, and Withdraw case. Resend invitation sends the same invitation email again; the booking link never expires, so there is no separate restart; unbooked cases also offer Book on behalf, and Book a custom appointment once the person has said they can't attend any date. Booked cases also offer Record did not attend, which marks the booking Did not attend or Unsuccessful with an optional internal reason, moves the case to Rebook required and emails the person to rebook. Cases that are not yet booked also offer "Flag case" (with a reason); a flagged case shows "Clear flag" instead. Each action opens a confirmation page with the question as the heading (for example "Are you sure you want to cancel Priya's booking?"), what will happen, the action button and "Go back". The resend pages show the email address and what the email contains. Cancel booking explains the person will be asked to rebook and points to Withdraw for removing them. Withdraw case asks for a reason, cancels the booking, returns any allocated device to stock and sends nothing to the person. Cancel booking and Withdraw case use the red warning button.
- **Archived cases** – a Completed or Withdrawn case is archived one month after its closed-on date. It is a date filter, not a status, so there is no archive job. The Cases list and the API leave archived cases out by default, and the API rejects any change to them. An archived case opens as a read-only record: numbered steps, all expanded, each with its date and engineer, checklists shown as done items, and no actions or note form. Cases are never deleted.

**Going back a step.** Up to step 4, the team can step back. Each move writes to the case journal.

- **Unallocate device (step 1)** returns the box to stock and sends the case back to step 1, with an optional reason. The device preparation checks are cleared, because they belong to that device, and a new box is prepared from scratch. Software prepared is kept because it belongs to the person, and is ticked again on the new device.
- **Reopen on step 2 or 3** moves the case back to that step and keeps the ticks.

Once Complete replacement (step 4) has run, the earlier steps are locked. Unallocate and Reopen are no longer offered, because Halo has already been updated and the device issued.

Allocation, unallocation, confirmed device preparation and the issue at completion are also written to the device's own journal on the Stock page, so each box has a full history across cases.

**Add a case** (manual) works by lookup. The case name is the person the laptop is for, not necessarily the Halo assigned user:

1. **Old device serial number** – looked up in Halo to fill in asset ID, hostname, model and the assigned user (with their email, job title and service area from the staff directory), then checked that it has no active case and has not been previously replaced.
2. **Is the person receiving the new laptop the same as the assigned user?** – radios. Yes keeps everything with the assigned user. No reveals an email field for the person receiving the laptop, looked up in the staff directory; the case is then in the receiver's name, the Halo assigned user is kept on it for reference, and invitations and booking emails go to the receiver.
3. **Type and next step** – Collection or Session, then either add to the invitation queue or book on their behalf straight away (no invitation sent).

**Book on behalf of user** uses the same steps as the user journey, ignores the booking lead time, still respects capacity, and records the team member as "Booked by".

### Stock

A live list of every replacement device matching the Halo stock criteria, refreshed from Halo: box number, serial and hostname, model, stock location and room, status (Available or Allocated), the case it is allocated to with that case's method and session date, and last activity. Search by box number, serial or hostname; filters for status, model, stock location and Include issued devices. Each device has its own page with its details from Halo, the case it's allocated to, its allocation history across cases and a journal with notes. This is the only list the case dropdown draws from, and a device allocated to one case is not offered to another.

### Statistics

A reporting page for the team, filtered by period (last 30 days, 3 months, 12 months or custom dates) and type, with a CSV download.

- **Headline figures** – laptops in stock (available and allocated, live from Halo), sessions held, replacements completed, and laptops awaiting the old device's return
- **Most requested software** – bookings per application, highest first, with typed-in applications grouped and listed separately so popular ones can be added to the software list
- **Most popular days** – bookings by weekday of the session, with a table view
- **Sessions in the period** – per type: held, places offered, booked, percentage filled and did not attend; cancelled sessions excluded

Figures come from bookings and cases in the portal, apart from stock, which comes from Halo.

### Settings

- **Software list** – names with an optional hint shown under the checkbox, always sorted alphabetically.
- **Portal content** – Markdown shown on the colleague's page under their booking and software, one version for each type, with {username}, {date} and {location}.
- **Frequently asked questions** – questions and answers shown as expandable details at the bottom of the colleague's page, each shown for Session, Collection or both, in a set order.
- **Emails** – the team name, the mailbox emails are sent from, a link to the portal email template and the service's emails (see Email templates).
- **Session defaults** – default start time, capacity and location per method.
- **Invitations and reminders** (Administrator users only) – invitations per working day (default 15), first reminder (days after the invitation, then a weekday), flag threshold, old device return reminders (on or off and a weekday; they can also be turned off on a single case), booking lead time (default 5 working days) and software lock (default 3 working days). Each has its own change page; number settings share one pattern.
- **Device preparation checks** – the ordered checks engineers tick on step 2 before the software step unlocks.
- **Decommission checklist** – the ordered checks engineers tick on step 6 before decommissioning an old device.
- **Connections** – Halo report API link, Halo stock API link, decommission hook link and Power Automate webhook link, stored as secrets with only the start shown and when each was last used, visible and editable by Administrator users only. A Connection log lists every call in the last 7 days with the time, connection, what triggered it, the case it was for and the result, with error details for failures. Entries are deleted after 7 days.

Changes to either checklist apply only to cases that haven't reached that step yet. Each checklist has inset text saying so: "Changes to this list only apply to cases that haven't progressed past step 1" (step 5 for the decommission checklist). The "checklist has changed" notice on a case only shows while the case is on that step.

### Users and Portal settings

These are portal-wide pages under Management in the Menu, for Administrator users.

- **Users** – everyone in the staff directory (Entra ID), searchable by name, email or username and filterable by role or "Portal users only", with job title, roles, whether they are a portal user and when they last signed in. A portal user is only created when something happens for that person: they sign in, they are added to a case, or someone saves a role for them. Nobody is imported up front.
- **A user's page** – their directory details (read-only, refreshed on sign-in) and role checkboxes: Administrator, Laptop replacements team and admin (Desktop Infrastructure), Smartphone replacements team and admin (Governance & Compliance) and New starters team. A side panel shows how the portal user was created, last sign-in, their cases and their role history.
- **Portal settings** – the portal email template (see Email templates).

## Business rules

Each rule is enforced on the server in the service layer, not only in the form, so user actions, team actions and scheduled jobs all obey it.

| Rule | Detail |
| --- | --- |
| Working days | Monday to Friday, excluding England and Wales bank holidays (from the GOV.UK bank holidays feed, cached daily). |
| Duplicate prevention | A Halo asset ID can have only one open case. Devices with an open case, a completed case or a previous replacement record are hidden on the import screen. |
| Method | Every case has a method set by the team before invitation. Users see and book only sessions of that method; the team can change it until a booking exists. |
| Invitation limit | The invitation job runs on working days only and sends at most 15 invitations (setting), oldest Queued first. The rest wait for the next working day. |
| Capacity | A booking is created only if active bookings are below the session's capacity, checked at the moment of saving. When the last place goes the session becomes Full and the team is notified; a cancel or rebook reopens it. |
| One active booking | A case can hold only one booking with status Booked. |
| Booking lead time | Users can book only sessions more than 5 working days away (a setting, default 5). This is applied, not explained, on the booking page. The team can book on behalf inside that window. |
| Software lock | Requested software locks at 00:00 on the 3rd working day before the session. Example: session Thursday 12 November 2026, lock from 00:00 Monday 9 November. After that only the team can change it, recorded as an override in the journal. |
| Software storage | Requested and prepared software are saved as arrays of names; free-text programs typed by the user or the team are stored the same way. Editing the software list never changes existing records. |
| Rebook | Users can rebook until the session starts, to a session of the same method. New booking linked to the old one; software carried over; journal "Session date changed from X to Y"; user and team notified. |
| No user cancel | Users cannot cancel. Only the team can cancel a booking or mark it did not attend or unsuccessful; the case moves to Rebook required with the reason recorded. |
| Device allocation | Allocation only ties a device to the case; Halo is not changed until the replacement is completed. One box number per case, chosen from the Halo stock list; a device allocated to a case is not offered to any other. Removing it clears the box number and it shows as available again. Both actions are journal entries. A team cancel does not remove the device. |
| Software prepared | Only the applications the user requested are listed. Engineers tick each one as it is installed and save; each save writes a journal entry with the list. |
| Reminders | Weekly on the reminder day (Monday by default), from the first reminder day at least 21 days after the invitation (or 7 days after a rebook request); the days and weekday are settings. Old device return reminders are weekly on their own day (Monday by default) while a case is Awaiting return; they can be turned off for everyone in Settings or on a single case. |
| Flag | A case is Flagged automatically when the 3rd reminder is sent, and the team can also flag a case by hand with a reason (for example "On annual leave until 23 November"), but only before it is booked: Queued, Pending or Rebook required. Once a case is booked there is nothing to chase, so Flag case is not offered. Flagged cases show the flag and its reason on the Cases list, the dashboard and the case. Flagging never changes the status or pauses reminders. Reminders continue; the team adds actions or notes in the journal and can clear the flag. |
| Attendance | "Complete replacement" on the case page requires an allocated device. It records attendance and runs the Halo completion update. The Halo update runs first; only when Halo confirms does the case move to Awaiting return. If Halo fails, nothing changes and a red Failed banner explains what happened; the engineer tries again from the same step. |
| Halo completion update | On the new device: status In Service, stock location and stock room cleared, audit details and last audit date set to today with the comment "Issued through the Device portal laptop replacement service". |
| Completion | The case is Completed only when the new device has been issued and the old device has been returned and decommissioned. The case page's steps, checklist saving and archiving are described under Cases. |
| Checklist copies | A case copies a checklist when it reaches that step and only reads its copy. Editing Settings applies only to cases that haven't started the step; started, finished and archived steps never change. |
| Archiving | Completed and Withdrawn cases are archived one month after their closed-on date. Archived is worked out from the date, not stored as a status. The API leaves archived cases out of lists by default and rejects any change to them. Cases are never deleted. |
| Withdraw | Needs a reason. Cancels any booking, returns an allocated device to stock and sends nothing to the person. |
| Email logging | Every email the portal triggers writes a journal entry on the case (event, recipient, time, webhook result), so each automation can be traced per case. |
| Audit | Every create, update or status change writes a journal entry with actor, time and before and after values. Entries are never edited or deleted. |

**External calls first.** Any action that calls Halo, the decommission hook or Power Automate makes that call before anything is saved. Only when the call succeeds is the database updated and the journal written, and the page shows a green success banner. If the call fails, nothing changes: the page shows a red "Failed" banner saying what failed, the response or timeout, a link to the Connection log, and that the person can try again. Every call, successful or not, is written to the Connection log.

## Scheduled jobs and events

The twelve Power Automate flows become seven scheduled jobs, the import screen and in-portal events; Status Alignment and Booking Deferrals are retired because bookings and case status live in one data model.

Scheduled jobs run as timer-triggered calls (Azure Functions timer trigger or equivalent) to secured job endpoints in the portal. Every job is idempotent: it selects by status and "last sent" dates, so a re-run never sends a duplicate. Each run writes a job log (started, finished, records processed, errors) visible to admins.

| Replaces flow | New job or event | Runs | What it does |
| --- | --- | --- | --- |
| Scheduled Workflow Initiation | Import screen | On demand | Halo report via API, background duplicate check, team ticks devices and sets method. |
| Scheduled Workflow Campaign | Send invitations | Working days 09:00 | Up to 15 oldest Queued cases get the invitation (naming their method) and move to Pending. |
| Scheduled Workflow Campaign Reminder | Send booking reminders | Mondays 09:00 | Pending cases 21+ days after invitation get a reminder; sets Flagged when the 3rd reminder is sent. |
| Scheduled Workflow Reschedule Campaign Reminder | Send rebook reminders | Mondays 09:00 | Same for Rebook required cases, from 7 days after the rebook request. |
| Scheduled Workflow Cleansing | Retired | – | No time limit on booking: reminders continue weekly until the person books or the case is withdrawn, and the case is flagged at the 3rd reminder. |
| Scheduled Session Reminder | Send session reminders | Working days 09:00 | Booked bookings whose session is 3 working days away get details, preparation steps and a software-locked notice. |
| Scheduled Completed Status Processing | Close sessions | Daily 08:00 | Lists yesterday's bookings still Booked at the top of the dashboard for the team to mark. |
| (new) | Halo update retry | Every 15 minutes | Retired: Halo is updated before anything is saved, so a failure leaves nothing to retry. |
| (new) | Send return reminders | Mondays 09:00 | Awaiting return cases with return reminders on get a reminder to bring back the old laptop. Stops once it is marked returned. |
| (new) | Decommission | Immediate | Runs the decommission hook when the engineer selects Decommission old device after every check is ticked; the case is closed only when the hook succeeds. A failure changes nothing and shows a Failed banner. |
| Scheduled Triggers | Admin actions | Immediate | Resend booking details, resend invitation, cancel booking, flag, clear flag and withdraw are audited actions on the case page, each behind its own confirmation page, restricted by role. |
| Automatic Booking Processing | Booking created | Immediate | Capacity and method check, booking saved, case to Booked, confirmation, journal; team notified if the session is now Full. |
| Automatic Software Processing | Software changed | Immediate | Lock check, array saved, journal. |
| (new) | Booking rebooked or cancelled | Immediate | Booking records updated, journal, notifications. |
| Scheduled Status Alignment | Retired | – | One source of truth. |
| Scheduled Booking Deferrals | Retired | – | Handled by rebook and team cancel. |

All the scheduled jobs run together at 09:00, so invitations and every kind of reminder go out at the same time.

Every email any of these sends is logged in the case journal, and each job run is logged with the cases it touched, so the team can trace exactly which automation did what.

## Notifications

The portal owns the emails. It decides when to send one, renders the subject and the HTML (the service's email inside the portal email template) and posts them by webhook to one Power Automate flow, which sends from the service's mailbox and does nothing else.

Each call is an HTTPS POST to the flow's "When an HTTP request is received" trigger with a JSON body like:

```json
{
  "template": "session_cancelled",
  "service": "laptop_replacements",
  "case": "LR-000160",
  "to": "sam.taylor@bcpcouncil.gov.uk",
  "from_name": "Desktop Infrastructure",
  "from": "desktopinfrastructure@bcpcouncil.gov.uk",
  "subject": "Your laptop replacement session on Wednesday 11 November has been cancelled",
  "preheader": "Your session on 11 November is cancelled. Choose a new date.",
  "html": "<!DOCTYPE html …></html>",
  "text": "Hello Sam, …"
}
```

The webhook URL is held as a secret, never in client code. The call is made before anything is saved (see External calls first). Every call, successful or not, writes an "Email sent" journal entry on the case with the email, recipient and result, and a Connection log entry.

| Email | To | Sent when | Timing |
| --- | --- | --- | --- |
| Invitation | User | Send invitations job: why, serial number, the method and what it involves, Book replacement link | Automatic |
| Booking reminder | User | Weekly until the person books | Setting: First reminder |
| Booking confirmation | User | A booking is made or changed, including a rebook, a custom appointment and booking on behalf: method, date, time, location, software, manage link | Automatic |
| Session reminder | User | 3 working days before the session: details, what to bring, software locked | Setting: Software lock |
| Session cancelled | User | The team cancels a session (the reason is not included) | Automatic |
| Rebook needed | User | The team cancels a booking or marks it did not attend or unsuccessful; weekly until rebooked | Automatic |
| Availability request received | User | The person tells us when they are available | Automatic |
| Device issued | User | The Halo completion update succeeds: new device details, how and when to return the old device | Automatic |
| Old device return reminder | User | Weekly while the case is Awaiting return | Setting: Old device return reminders |

**Emails each day.** The Emails section of Settings shows how many emails went out today and how many are scheduled for tomorrow, and links to an Emails each day page. It has three parts: today (sent so far and failed), the next 5 working days (what the 09:00 jobs will send, split into invitations, booking reminders, rebook needed, session reminders and return reminders, worked out from the queue, bookings and settings) and the last 5 working days (invitations, reminders, emails sent when something happened, and failures). Monday is usually the busiest day because the weekly reminders go out with the invitations. Every email is counted for 13 months; the connection log keeps the detail of each call for 7 days.

## Integration

HaloITSM stays the asset register: the portal reads devices from it and writes back only the outcome of a replacement, with no tickets raised.

### HaloITSM

| Direction | When | What |
| --- | --- | --- |
| Read | Import screen | End-of-life devices from the Halo report: asset ID, serial, hostname, assigned user |
| Read | Stock page and case dropdown | Replacement devices matching the Halo stock criteria: box number, serial, hostname, model |
| Read | Showing a case or the dashboard | Serial and hostname of the allocated box number |
| Write | Attendance | New device: status In Service; stock location and stock room cleared; audit details and last audit date set to today with a replacement-service comment |
| Write | Old device marked returned | Old device status (exact values to confirm, see Open questions) |

Calls go through Halo's REST API with a dedicated client-credentials application, server-side only. Each write-back is made before anything is saved in the portal; if it fails, nothing changes and the person sees a Failed banner.

### Staff directory

Read from Entra ID through Microsoft Graph when importing, adding a case and showing a case: username, job title, department, whether the account is enabled, and last sign-in. These are read-only in the portal.

### Decommission hook

An HTTPS endpoint, with its link held in Settings under Connections, called when a case's decommission checklist is complete. It receives the old device's asset ID, serial and hostname. If the call fails, nothing changes and the engineer sees a Failed banner and can try again.

### Power Automate

One flow sends every email. The portal posts the finished subject, HTML and plain text with the recipient and sender (see Notifications), and the flow only sends it. No logic, timings or templates live in Power Automate.

### Device portal platform

The service uses the portal's existing Entra ID sign-in and journal. The Users page lists everyone in the staff directory; a portal user is only created when something happens for that person (they sign in, are added to a case or are given a role). Roles are per service: Administrator (portal-wide: Portal settings, Users, Connections), Laptop replacements team and admin (Desktop Infrastructure), Smartphone replacements team and admin (Governance & Compliance), and New starters team. A team role works on cases, sessions and stock; the admin role adds that service's Settings. Role changes are kept in a role history.

### PostgreSQL as the data store

Data is held in PostgreSQL 16 on Azure Database for PostgreSQL Flexible Server, with PgBouncer in front. The full design is in the project's database schema document. Three points shape it:

- **Schemas** – `portal` for what every service shares (users, roles, the email template, journal), `lr` for laptop replacements and `sr` for smartphone replacements. Statuses and methods are check constraints, and migrations are numbered SQL files run in order.
- **Software lists** – requested and prepared software are `jsonb` arrays; the software list itself is a small table of names with a sort order.
- **Capacity and allocation** – a booking checks and takes a place in one transaction, with the session row locked, so a session can never be overbooked and one device can never be allocated to two cases. A full session is caught live on the page and again on submission.

Calls to Halo and Power Automate happen before anything is written. The database only changes once the call succeeds; if it fails nothing is saved and the page shows a Failed banner. Every call is recorded in a connection log that keeps 7 days.

## Open questions

- [ ] Halo report, stock criteria and API details (Ben to provide)
- [ ] Should the old device's status change in Halo when it is marked returned, or is that handled outside the portal?
- [ ] Does removing a device from a case need a reason, or is the journal entry enough?
- [ ] Decommission hook endpoint, authentication and payload (Ben to provide)
- [ ] BCP username format, and whether case pages say Department or Service area (the Import user details use Service area)

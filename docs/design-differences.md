# Design notes: Quay vs Harbour and the mockups

Quay's components are a design system, not only the portal's own parts. They started from Harbour's `components/ui` (`bcp-fms`, design system version 4). Every visual value comes from the **Device Portal Mockups** canvas, which is treated as the source of truth.

This file covers three things:

1. how the mockups were read, and where they contradict themselves
2. where Quay differs from Harbour
3. what the Components page shows that isn't built yet

## 1. Reading the mockups

The canvas has three pages:

- **Components:** one definition of each component.
- **Laptop replacements:** 77 screens, the most up to date.
- **Portal home:** 12 screens.

The rule used: **the Components page defines each component, unless the Laptop replacements screens consistently use something else, in which case the screens win.** Values were taken from the CSS of all 99 artboards (`analysis` script in the session scratchpad), counting how many screens use each variant.

### Contradictions to settle in the mockups

- **Times:** the Sessions mockups write "10:00am" and "2:00pm"; Quay writes times in GOV.UK style, "10am" and "2pm" (and "9:30am", "midday"), as the email variables do.

| What | Components page | Laptop replacements screens | Built as |
|---|---|---|---|
| Inset text | Grey box (#f5f4f2, 28px 32px) | 25 team screens use a 10px grey left border (20px 24px); 5 colleague screens use the grey box | Left border |
| Success banner | Large title bar (19px bold) and 24px heading | Same on 14 screens, but the case pages (10) use a smaller bar (17px) with a 21px heading, like the Failed banner | Large, as on the Components page |
| Menu panel | 30px/40px padding, 14px under headings, 12px between links | Same on 59 screens; the AdminMenuOpen artboard alone uses 50px/60px, 20px, 18px | 30px/40px |
| Radios | Custom-drawn 40px circle | 18 screens use the native radio with `accent-color`; 7 use the custom one | Custom-drawn (looks the same, consistent focus) |
| Hint text | 17px | 17px on case and settings screens; 19px on confirmation pages | 17px |
| Labels and legends at 24px | Bold (700) | 700 on settings screens; 500 on confirmation pages | 700 |
| Form group spacing | 30px | 26px (filters), 30px, 36px (settings) | 30px |
| Main column beside a sidebar | LayTemplates: "at most 720px" | Case screens let it fill the space (about 760px) | Fills the space |
| Session default start time | — | Settings screen shows 09:30 for Session | 10:00 (your decision) |
| Phone gutters on colleague pages | — | 16px (team pages 20px) | 20px everywhere, because Harbour's Container has no gutter option |
| Red tag ("Full", "Withdrawn") | #ca3535 on #faebea | Same | #c03030 (4.89:1). The mockup's #ca3535 is 4.45:1, under the WCAG AA 4.5:1 minimum; the mockup is being updated |
| Warning button shadow | #6e1b1b | #6e1c1c (14 screens) | #6e1c1c |
| Failed banner red | #d4351c | #d4351c | #d4351c, the only place this red appears |

### Changed from the mockups on request

- **User page:** "These details come from Halo", not "from Entra ID": staff details come from Halo, and Entra ID is only for sign-in.
- **"We could not sign you in":** 20px between "Try again" and the reference (the paragraph spacing) rather than the mockup's 40px, as Quay's buttons have no margin of their own.

- **Header logo:** 28px tall, not 36px (the footer logo stays 36px).
- **Menu button:** black, bold and 1rem (16px), with the chevron on the left and no underline. On hover a 3px line runs under the whole button, chevron included, 4px below the text. The menu closes on any route change. The mockups show a blue, underlined 19px link-style button with the chevron on the right.
- **Logo:** Harbour's BCP Council logo SVG (`components/icons/organisations/bcp-logo.tsx`), not the mockups' "BCP Council Device portal" image. The link's accessible name is "BCP Council Device portal".

### Where the mockups say nothing

- **Session filters:** the mockup's filter sidebar has only "Clear filters". Quay adds a secondary "Apply filters" button (and makes "Clear filters" a link), because filtering as each select changes would move people on without warning (WCAG 3.2.2).
- **Closed sessions and Withdrawn cases:** no tag colour in the mockups; both are grey, like Cancelled and Completed.
- **Cancelling a session when an email fails:** a red Failed banner names who wasn't emailed, above the green "Session cancelled" banner, and the "Email sent" column shows a red "Not sent" tag.

- **Development sign-in:** `/auth/dev`, until the Entra app registration exists, lists the mock Halo users as radios. It is not a real screen.
- **Smartphone role tags:** the Users mockups show Administrator (purple), laptop roles (blue) and New starters (green); smartphone roles use turquoise.

- **Warning button hover:** there isn't one in the mockups, so it darkens to `--bcp-colour-dark-red` like the other buttons.
- **Buttons at phone width:** not shown in the mockups. Harbour makes them full width; Quay leaves them at their natural width, as drawn.

## 2. Differences from Harbour

### Structure

| Area | Harbour | Quay | Why |
|---|---|---|---|
| Stories and tests | None; the README suggests tests beside components | `stories/` and `tests/` at the root | Keeps each component folder to its two files |
| Exports | `Link` is a default export | Named exports throughout | Consistency |
| Client components | `Button`, `Header`, `ServiceNavigation` are client components | Server components; only `ErrorSummary`, `ShowMore`, `Modal` and `HeaderMenu` are client | Smaller bundle |
| `Button` | `removeParam` prop | Dropped | Needs a client router |
| `Notification` | Purple, with a Close button, class `c-notification-banner` | `NotificationBanner`: Success (green), Important (blue), Failed (red, smaller); no Close button | Mockups; the `c-` prefix didn't follow the standard |
| `Header` | Logo, environment tag, and a menu that only shows on phones | The same BCP Council logo SVG (28px tall) and a slot on the right; no environment tag. `HeaderMenu` adds the Menu disclosure, which works at every width and opens a panel under the header | Mockups ("Header: team") |
| `ServiceNavigation` | Collapses behind its own Menu on phones | Wraps on phones | Mockups; the header already has a Menu |
| `Breadcrumbs` | Last crumb is the current page; SVG chevron | Ancestors only, all links, "›" hidden from screen readers | Mockups |
| `Sidebar` | Grey panel with a phone-only toggle | Grey panel (30px padding), no toggle, rendered as a named `aside`; `SidebarLayout` places it | Mockups show it open at every width |
| `Footer` | Fixed links | Same links by default; `links` prop to change them | Reuse across sites |
| External links | Open in a new tab automatically | Same tab unless `newTab`, which says "(opens in new tab)" to screen readers | GOV.UK guidance |
| `Markdown` | Parses straight to React; every line is its own paragraph; links kept whatever the address; `^` inset, `%` warning, `~` details and `\|` call-to-action blocks | One parser (`lib/markdown/parse.ts`) with three outputs: the `Markdown` component, inline-styled email HTML and plain text. Lines join into one paragraph and two trailing spaces make a line break (standard Markdown); only web, email, phone and in-portal links are kept, others become text; numbered lists keep their start number; `^`, `%` and `~` blocks kept, `\|` dropped | Emails need the same Markdown as HTML and text, and the mockup's "Thank you,<br>Desktop Infrastructure" needs line breaks; Quay has no call-to-action component |

### Widths

`Container` is Harbour's, with the same props and class names: `width` (full, large, medium), `contentWidth` (full, half, third) and `space` for vertical padding, with default spacing when rendered as `main`. Two changes: `main` also gets `tabIndex={-1}` so the skip link moves focus there, and the phone rule follows the 640px breakpoint and the gutter token rather than Harbour's fixed 16px.

The mockups' two page widths go into Harbour's tiers, so two token values change:

| Token | Harbour | Quay |
|---|---|---|
| `--bcp-width-container-full` | **1440** | **1260** (team pages) |
| `--bcp-width-container-large` | **1020** | **1100** (colleague pages) |
| `--bcp-width-container-half` | 820 | 820 |
| `--bcp-width-container-third` | 540 | 540 |
| `--bcp-width-input-max` | 720 | 720 (also the confirmation page column) |
| `--bcp-width-sidebar` | — (300 in Harbour's sidebar CSS) | 320 |
| `--bcp-wrapper-horizontal` | 32px, 20px on phones | 60px, 20px on phones |
| Phone breakpoint | 699px | 640px |

The mockups' column widths (760px colleague column, 680px question pages) aren't Container options. The page templates in `components/layouts/` set them.

### Form controls

Harbour's form controls were rebuilt to these accessibility rules:

- Hints and errors are linked to the field, or to the fieldset for groups, with `aria-describedby`.
- Error messages start with a hidden "Error:".
- The error summary links each message to its field, moves focus there and scrolls the label into view.
- Radios and checkboxes draw a 40px control (24px when `small`), with a 44px touch target and a hint for each option.
- Conditional reveal uses CSS `:has(:checked)`.
- Radios can include an "or" divider.
- The first item's id follows GOV.UK (`name`, `name-2`…).
- A label or legend can be the page `h1` and carry a caption.
- `Select` is the native control with no forced "Select" option.
- `TimeInput` is new.

Harbour styles bare `input`, `select` and `textarea` globally; Quay styles them only through classes.

### Tokens and type

| | Harbour | Quay (mockups) |
|---|---|---|
| Link | `--bcp-colour-blue` #015aa7 | `--bcp-colour-link` #1d70b8, hover #003078 |
| Focus | Yellow outline | Yellow background with a dark underline (links), yellow outline with an inset border (fields) |
| Secondary text | #484949 | #505a5f |
| Font sizes | xl 2.85rem, lg 2rem, md 1.39rem, body 1.185rem, sm 1rem | xl 48, lg 30, ml 27 (h2), md 24, ms 21 (h3), body 19, sm 17, xs 16 (px) |
| Headings | 600 | 700; h3 is 500 |
| Primary button | Rounded, inset shadow, brightness hover | Square, 3px #083d2a shadow, #005a30 hover |
| Destructive button | `danger` | `warning` (GOV.UK name), #ca3535 |
| Tags | 10% tint of the text colour | Fixed tint pairs from the mockups |

## 3. Components page coverage

Everything on the mockups' Components and Patterns pages is now built, apart from the bar charts on the Statistics screen, which are left for the Statistics stage. The folders follow the mockups' split: **components** in `components/ui/`, **patterns** that combine them in `components/patterns/`, service-specific pieces in `components/service/replacements/`. Storybook has the same four sections: Components, Patterns, Service, Layouts.

| Mockup item | Where | Built as |
|---|---|---|
| Accordion | Component | `Accordion` (client): "Show all sections", each heading a button with `aria-expanded` |
| Stat tiles | Component | `StatTiles`: a `dl`, three or four across, two under 900px, one on phones |
| Journal list | Component | `Timeline`: dated entries with who did it |
| Date navigation | Component | `DateNavigation` |
| Replacement steps | Component | `StepList`: general steps, not tied to replacements |
| Table second lines | Component | `TableSecondary` variants: `step` (grey, 6px gap) and `flag` (red) |
| Sidebar filters | Component | `SidebarLayout` with `position="start"` and `Sidebar` |
| Journal | Pattern | `Journal`: the heading, the "Add a note" form and the `Timeline`; read-only without a note action |
| Search with filters | Pattern | `FilterPanel` (client) with `FilterGrid` and `FilterOptions`: search and filters are one GET form |
| Choose columns | Pattern | `ColumnChooser`, inside `FilterPanel` |
| Applied filters | Pattern | `AppliedFilters`: each chip is a link to the page without that filter |
| Group heading | Pattern | `GroupHeading` |
| Action list | Pattern | `ActionList`, inside a `Sidebar` |
| Lookup field | Pattern | `LookupField` and `LookupResult`; the Find button submits the form |
| Add another | Pattern | `AddAnother` (client): Remove is a button, not a link, because it acts on the page |
| Check answers | Pattern (story only) | `SummaryList` (with `SummaryListSecondary`), a heading and a button |
| Collection and Session tags | Service: replacements | `TypeTag` |

Harbour's component-structure standard has `ui`, `layouts` and `service/<service>`; `patterns` is a new tier.

### Decisions and notes

- **Replacement steps are always open**, with no Show/Hide or "Show all steps". The mockups show this; the spec's Show/Hide is out of date.
- **Column choices are not remembered.** They live in the URL like the other filters. The mockups' hint "Your choice is remembered next time" should be dropped wherever the column chooser is used.
- **Filter panel fields** are a size smaller than form fields (17px labels, 40px selects), as drawn. `FilterPanel` styles them; the fields themselves are the normal `Select` and `Checkbox`.
- **Week headings** between radios on the date choice screens ("Week starting 9 November 2026", 24px bold) are page content, not a component.
- **Visually hidden text** after visible words, such as "Change *booking*", now has the space outside the hidden span. With it inside, the accessible name read "Changebooking".

# Kickoff prompt for Claude Code

Put `CLAUDE.md` in the repo root and `docs/` beside it, then paste the prompt below.

---

You're picking up the Device portal for BCP Council's Quay platform. Start by reading `CLAUDE.md`, then `docs/laptop-replacement-spec.md` and `docs/database-schema.md` in full, then `docs/mockups.md`.

The first service is laptop replacements. The database schema is already designed (migrations 0001–0012) and the spec is settled apart from the open questions listed in `CLAUDE.md`. We're building interface first, against mock data, then wiring in the real Halo, Microsoft Graph, Power Automate and decommission hook clients.

Before writing any code:

1. Look at what's already in the repo and tell me what exists (Next.js app, `db/` folder, components, Storybook, auth) and what doesn't.
2. Summarise your understanding of the service in a few lines: the case lifecycle, the six case steps, and the "external calls first" rule.
3. List any conflicts you find between the spec, the schema and `CLAUDE.md`, and anything you'd need from me.
4. Propose a folder structure (`/app`, `/app/api` mirroring services, `services/replacements/laptops/...`, `lib/clients/...`, `db/`, components and CSS) and a build plan in small, reviewable stages. Stage 1 should be the portal shell (layout, header with Menu button, service navigation) and shared GOV.UK-style components in vanilla CSS with `bcp-` BEM names, viewable in Storybook.

Stop after the plan and wait for me to agree it. Don't commit or push unless I ask.

Rules to hold throughout:

- Schema-qualify every SQL table; follow the PgBouncer rules in `CLAUDE.md`.
- All external calls through reusable server-side clients; mock implementations behind the same interfaces until real details arrive.
- Business rules live in the service layer, not only in forms.
- GOV.UK Design System patterns and WCAG 2.2 AA; no Tailwind or CSS Modules.
- Never edit a migration that has already run; add a new numbered one.
- Don't guess at open questions; ask or leave a clearly marked stub.

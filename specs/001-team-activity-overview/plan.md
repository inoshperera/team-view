# Implementation Plan: Team Activity Overview

**Branch**: `001-team-activity-overview` | **Date**: 2026-05-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-team-activity-overview/spec.md`

## Summary

Expand the local, client-side Redmine activity dashboard from a today-only,
single-activity card into a period-based team activity board. The dashboard will
provide a top period selector for Today, Yesterday, This Week, Last Week, and
Custom Range. Each team member tile will summarize all Redmine time entries in
the selected period, group entries into activity/ticket rows, show up to five
rows on the tile, show total spent time, show remaining estimate status based on
Redmine issue estimated hours when available, and open a member detail view with
the full period activity list.

The implementation remains static vanilla HTML, CSS, and JavaScript, plus the
existing local Python proxy for credentialed Redmine API calls.

## Technical Context

**Language/Version**: HTML5, CSS3, vanilla JavaScript ES modules, Python 3.10+
for the local proxy

**Primary Dependencies**: Browser Fetch API and Python standard library for the
proxy; no frontend framework and no build step

**Storage**: Local configuration files only; no database or server-side
persistence for MVP

**Testing**: Manual quickstart verification, Chrome/browser smoke testing,
proxy smoke testing with Redmine responses, source syntax checks, and mobile
layout screenshots

**Target Platform**: Local desktop browser with a local proxy process

**Project Type**: Static web application with a small local proxy helper

**Performance Goals**: Period refresh returns updated data or a visible error
within 15 seconds under normal network conditions for roughly 5-25 members; the
user can understand team activity within 30 seconds of load or period change

**Constraints**: No browser-readable credentials; no required build step; all
summary, detail, and estimate data must be scoped to the selected period

**Scale/Scope**: Small internal team dashboard. The app must handle Redmine
pagination for time entries and issue lookups for activity rows that need
estimated-hours data. Custom ranges should remain reasonable for local use; very
large ranges may be slower and should show loading state.

## Constitution Check

*GATE: Must pass before design refresh. Re-check after design update.*

- **I. Client-Side Simplicity**: PASS. The plan stays in static HTML/CSS/JS and
  avoids a frontend framework or build pipeline.
- **II. Proxy-Only Redmine Access**: PASS. Redmine API credentials remain behind
  the local proxy boundary.
- **III. MVP Visibility Before Analytics**: PASS. Period totals and remaining
  estimates are operational visibility, not productivity scoring or ranking.
- **IV. Human-Readable Activity State**: PASS. Tiles show grouped activity rows,
  period totals, and explicit estimate labels rather than raw Redmine records.
- **V. Reference-Guided, Not Reference-Copied**: PASS. The reference app informs
  endpoint usage only; the UI remains a purpose-built activity board.

## Project Structure

### Documentation (this feature)

```text
specs/001-team-activity-overview/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── redmine-proxy.md
│   └── ui-states.md
└── tasks.md
```

### Source Code (repository root)

```text
.
├── index.html
├── styles.css
├── app.js
├── config.example.js
├── config.local.js
├── proxy.py
├── requirements.txt
├── README.md
├── referance/
└── specs/
```

**Structure Decision**: Keep the flat static-web structure at repository root.
The feature can be implemented with additional state and render functions in
`app.js`, period-selector markup in `index.html`, responsive styling in
`styles.css`, and issue-detail forwarding through `proxy.py`.

## Design Decisions

### Period Selection

- Add a top control with preset options: `today`, `yesterday`, `this-week`,
  `last-week`, and `custom`.
- Preset ranges are computed in the browser using the user's local date.
- Custom range exposes start and end date inputs and validates start <= end.
- Every fetch, tile, detail view, status count, total, and estimate must use the
  active selected period.

### Redmine Data Access

- Time entries should be fetched with `/time_entries.json?user_id={id}&from={start}&to={end}` where supported.
- Pagination remains required because Redmine list responses may be partial.
- Activity rows with issue IDs should fetch `/issues/{id}.json` through the
  proxy to obtain `estimated_hours` and issue subject/status when available.
- Issue fetches should be cached per issue ID during a refresh to avoid repeated
  requests when multiple members or entries reference the same issue.
- Entries without issue IDs remain visible but have unknown remaining estimate.

### Tile Activity Rows

- Normalize time entries, then group by issue ID when present; otherwise group by
  project + activity + comments fallback.
- Sort grouped activity rows by latest activity timestamp, then spent time.
- Show at most five rows on each member tile.
- Show hidden activity count when more than five rows exist.

### Spent And Remaining Estimates

- Total spent time is the sum of all member time entries in the selected period.
- Per-activity spent time is the sum of grouped entries in the selected period.
- Remaining estimate is computed from Redmine issue estimated hours minus spent
  time for the grouped issue when an estimate exists.
- Member remaining estimate is the sum of known remaining values across grouped
  issue rows. If any displayed/grouped issue lacks estimate data, mark the member
  value as partial or unknown.
- Remaining values must never be displayed as exact confirmed capacity.

### Detail View

- Clicking a member tile opens an in-page detail view, side panel, or modal.
- Detail view shows selected period label, all activity rows for that member,
  total spent time, issue estimate data, remaining estimate state, warnings, and
  close/back action.
- Detail view should preserve the selected period and update or close clearly
  when the period changes.

## Phase 0: Research

Research decisions are captured in [research.md](./research.md). The expanded
scope adds one decision: remaining-time values are derived from Redmine issue
estimated hours when available and must be labeled partial/unknown when data is
missing.

## Phase 1: Design & Contracts

Design artifacts are captured in:

- [data-model.md](./data-model.md)
- [contracts/redmine-proxy.md](./contracts/redmine-proxy.md)
- [contracts/ui-states.md](./contracts/ui-states.md)
- [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- **I. Client-Side Simplicity**: PASS. The expanded design still fits the flat
  static app.
- **II. Proxy-Only Redmine Access**: PASS. Issue estimate lookups go through the
  proxy and do not expose credentials.
- **III. MVP Visibility Before Analytics**: PASS. No productivity scoring or
  ranking is introduced.
- **IV. Human-Readable Activity State**: PASS. Period cards, detail view, and
  estimate-state labels remain user-facing summaries.
- **V. Reference-Guided, Not Reference-Copied**: PASS. The design expands the
  new board experience rather than copying the old reporting dashboard.

## Complexity Tracking

No constitution violations or complexity exceptions are required. The only added
complexity is Redmine issue lookup caching for estimate data, which is justified
by the requirement to show remaining estimated time.

## Append-Only Design Addendum: Multi-View Work Overview

This addendum captures the next design layer requested after the period-based
time-log dashboard. It appends scope without replacing the completed MVP plan.

### Time Logs Period Presets

- Replace the visible Time Logs period presets with `last-week`, `last-month`,
  `this-month`, and `custom`.
- Remove Today and Yesterday from the visible selector because the team normally
  logs time weekly.
- Keep custom range validation and inclusive date behavior from the existing
  period implementation.

### View Selection

- Add a top-level selector with `time-logs` and `work-overview`.
- Keep each view's filters in memory during the browser session so switching
  views does not reset the user's immediate context.
- Show only view-relevant controls: period controls for Time Logs; work-scope
  selector and settings action for Work Overview.
- Manual refresh reloads data for the active view only.

### Team Configuration

- Extend `window.TEAM_ACTIVITY_CONFIG` with `teams`, where each team has a stable
  `id`, display `name`, and `memberIds`.
- Settings opens an in-page configuration view/panel in Work Overview.
- The settings view lists all configured active users and all configured teams.
- Users can create, rename, and remove teams and assign users with checkboxes or
  comparable multi-select controls.
- Because the app is static, the first implementation should generate or update
  an exportable JSON config block; direct writing to `config.local.js` requires a
  later local helper.

### Work Overview

- Work scope supports `team` and `users` modes.
- User search filters the configured member list by name and allows selecting
  one or more members.
- Known Redmine status display values are: On hold, New, Development Ready,
  Design, Implementation, Review, Testing, Staged, Testing Ready, Testing
  Rejected, Closed, and In Progress.
- Working tickets are assigned issues whose status is not `New` and not
  `Closed`. Unknown statuses are treated as working but flagged as unrecognized.
- Per selected scope, render total working tickets and active people count.
- Per selected user, render all working tickets with issue ID, subject or
  description, tracker, status, priority, start date, and due/end date.
- Users with no working tickets remain visible with a clear empty state.

### Post-T077 Implementation Reality

The delivered Work Overview evolved through fast feedback after the original
T077-T106 slice. These notes supersede the earlier broad sketch where they
conflict:

- Work Overview opens by default. Time Logs remains available from the View
  selector for retrospective period-based review.
- Work scope now exposes only `team` and `users`. Full Team was removed because
  the high-signal path is either a configured team or an intentional user
  selection.
- Team settings persist through local JSON: the browser posts to
  `/team-config.json`, and the proxy writes `team-config.local.json`.
- Settings uses all active Redmine users from `/users.json`, not only the
  initially configured sample team. Team editors are accordion-like, search
  within users, and keep selected users at the top.
- Working tickets exclude `New`, `Closed`, `On hold`, `Staged`, and
  `Testing Rejected`. The summary's non-working stat focuses on New and On hold.
- Ticket links resolve to `{redmineBaseUrl}/issues/{issueId}` using
  `/proxy-config.json` so the user lands in Redmine rather than localhost.
- Work tickets include project, tracker, status, priority, dates, estimated
  hours, and spent hours when Redmine provides them.
- Compact cards are default. Their wording is driven by
  `data/work-overview-phrases.json`, generated from the reviewed Excel matrix in
  `outputs/work-overview-copy/work_overview_phrase_matrix.xlsx`.
- The "Show detailed ticket" checkbox toggles between compact summary cards and
  the detailed tracker/status/project view without reloading data.
- The logged-time presentation reads as `Logged vs estimated`, for example
  `45h / 40h`.

### Redmine Issue Access For Work Overview

- Work Overview should fetch assigned issues with Redmine issue-list queries such
  as `/issues.json?assigned_to_id={id}&status_id=*`, then filter by status name
  client-side when needed.
- The proxy allowlist must include read-only issue list access plus issue detail
  access without exposing credentials.
- Issue list pagination must be handled the same way time-entry pagination is
  handled.

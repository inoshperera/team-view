# Feature Specification: Team Activity Overview

**Feature Branch**: `001-team-activity-overview`

**Created**: 2026-05-12

**Status**: Draft - expanded for period-based activity overview

**Input**: User description: "Build an MVP dashboard that shows a high-level overview of what each selected team member is currently or recently working on using Redmine data. Expand it with a period selector for today, yesterday, this week, last week, and custom range. Each team member tile should list up to 5 activities/tickets instead of only 1 ticket. Each card should show total time spent for all tickets in the selected period and how much estimated time remains across those tickets. Clicking a user should open a more detailed view."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review Team Activity By Period (Priority: P1)

As a team lead, I want to choose a reporting period and see what each selected
team member worked on during that period so I can understand team focus without
opening Redmine for each person.

**Why this priority**: The period selector changes the dashboard from a
today-only view into the primary high-level workflow requested by the user.

**Independent Test**: Can be tested by selecting Today, Yesterday, This Week,
Last Week, and a Custom range, then confirming every selected team member is
shown with activity data scoped to that selected period.

**Acceptance Scenarios**:

1. **Given** the dashboard is open, **When** the user selects Today,
   **Then** all member tiles summarize only today's Redmine time entries.
2. **Given** the dashboard is open, **When** the user selects Yesterday,
   **Then** all member tiles summarize only yesterday's Redmine time entries.
3. **Given** the dashboard is open, **When** the user selects This Week or Last
   Week, **Then** all member tiles summarize entries from the correct week range.
4. **Given** the user selects Custom Range and enters valid start/end dates,
   **When** the user applies the range, **Then** all member tiles summarize
   entries within that inclusive date range.
5. **Given** a selected member has no entries in the selected period, **When**
   the dashboard renders, **Then** that member remains visible with a clear
   no-activity-for-period state.

---

### User Story 2 - Scan Up To Five Activities Per Person (Priority: P1)

As a team lead, I want each team member tile to show the top few activities or
tickets they worked on so I can quickly understand more than one current work
item per person.

**Why this priority**: The tile must become a high-level activity summary rather
than a single-ticket snapshot.

**Independent Test**: Can be tested using a member with more than five entries
or issues in the selected period and confirming only the five most relevant
activity rows appear on the tile while the detail view contains the full list.

**Acceptance Scenarios**:

1. **Given** a member has one to five activities in the selected period,
   **When** the tile renders, **Then** all those activities are listed on the
   tile with project, issue or fallback label, activity name, and spent time.
2. **Given** a member has more than five activities in the selected period,
   **When** the tile renders, **Then** the tile lists at most five activities and
   indicates that more are available in the detail view.
3. **Given** Redmine entries have no issue reference,
   **When** the tile renders, **Then** those entries still appear with a
   readable fallback label.

---

### User Story 3 - See Spent And Remaining Estimate Per Person (Priority: P2)

As a team lead, I want each member tile to show total time spent in the selected
period and the estimated remaining time across the tickets shown for that person
so I can understand rough workload pressure.

**Why this priority**: Period totals and remaining estimates are important for
capacity awareness, but they depend on period activity aggregation.

**Independent Test**: Can be tested with Redmine issues that include estimated
hours and time entries, confirming the tile shows total spent time and a labeled
remaining estimate; issues without estimates should produce an unknown/partial
estimate state.

**Acceptance Scenarios**:

1. **Given** displayed activities have Redmine issue estimates,
   **When** the member tile renders, **Then** it shows total spent time for the
   selected period and estimated remaining time across those issues.
2. **Given** one or more displayed activities lack Redmine issue estimates,
   **When** the member tile renders, **Then** the remaining value is marked as
   partial or unknown rather than treated as exact.
3. **Given** total spent time exceeds available estimates,
   **When** the member tile renders, **Then** remaining time is shown as zero or
   over-estimate with a warning, not as a negative workload.

---

### User Story 4 - Inspect A Team Member Detail View (Priority: P3)

As a team lead, I want to click a team member tile and see a more detailed view
of that person's activities for the selected period so I can review the full
context without losing the high-level board.

**Why this priority**: The tile must stay compact, so detailed investigation
belongs in a drill-down view.

**Independent Test**: Can be tested by clicking a member tile and confirming a
detail panel opens with the selected period, full activity list, totals,
remaining estimate details, and a close/back action.

**Acceptance Scenarios**:

1. **Given** a member tile is visible, **When** the user clicks the tile,
   **Then** a detail view opens for that member and selected period.
2. **Given** a detail view is open, **When** the user closes it,
   **Then** the dashboard returns to the same selected period and filter state.
3. **Given** the selected period changes while a detail view is open,
   **When** the dashboard refreshes,
   **Then** the detail view updates or closes clearly rather than showing stale
   period data as current.

---

### User Story 5 - Refresh And Recover From Data Issues (Priority: P4)

As a team lead, I want to refresh the dashboard and understand when Redmine data
cannot be loaded so I can trust whether the view is current.

**Why this priority**: Data freshness matters for operational visibility, but it
is secondary to the period summary and drill-down workflow.

**Independent Test**: Can be tested by loading the dashboard, refreshing data,
and simulating proxy or Redmine failures to verify loading, success, partial,
empty, and error states.

**Acceptance Scenarios**:

1. **Given** the dashboard is open, **When** the user refreshes activity data,
   **Then** activities are reloaded for the currently selected period and the
   last-updated time is visible.
2. **Given** Redmine or the proxy cannot be reached, **When** the dashboard tries
   to load data, **Then** the user sees a clear error state and any previously
   loaded data is not presented as freshly updated.
3. **Given** Redmine responds slowly, **When** data is loading, **Then** the user
   sees a loading state until the dashboard succeeds or fails.

---

## Next Scope Addendum: Multi-View Work Overview

The following stories append new design scope on top of the existing
period-based time-log dashboard. They do not replace the existing MVP stories.

### User Story 6 - Switch Dashboard Views (Priority: P1)

As a team lead, I want a top-level view selector so I can switch between the
time-log dashboard and the work-overview dashboard without opening a different
tool.

**Why this priority**: The new work-overview dashboard must coexist with the
current time-log dashboard and make the product extensible for more views later.

**Independent Test**: Can be tested by switching the top dropdown between Time
Logs and Work Overview and confirming the correct controls, board content, and
refresh behavior appear for each view.

**Acceptance Scenarios**:

1. **Given** the dashboard is open, **When** the user selects Time Logs,
   **Then** the weekly/monthly period selector and time-log member cards are
   shown.
2. **Given** the dashboard is open, **When** the user selects Work Overview,
   **Then** the work-scope selector, settings button, work summary metrics, and
   assigned-ticket board are shown.
3. **Given** the user changes views, **When** they return to a previously opened
   view, **Then** the last selected filters for that view remain available during
   the current browser session.

---

### User Story 7 - Configure Teams Locally (Priority: P2)

As a team lead, I want a settings view where I can create teams and assign
configured Redmine users to those teams so dashboard filters match how the team
actually works.

**Why this priority**: The work-overview dashboard depends on team-based
selection, and the configuration should remain simple JSON rather than a server
database.

**Independent Test**: Can be tested by opening settings, creating a team,
assigning users to it, and confirming the dashboard can filter to that team
using the JSON-backed configuration.

**Acceptance Scenarios**:

1. **Given** Work Overview is selected, **When** the user clicks Settings,
   **Then** a team configuration view opens with all configured users and current
   teams.
2. **Given** the settings view is open, **When** the user creates or renames a
   team and assigns users, **Then** the resulting team structure is represented
   as JSON compatible with the local config file.
3. **Given** a user is assigned to a team, **When** the dashboard team filter is
   changed to that team, **Then** that user is included in the work-overview
   results.

---

### User Story 8 - Review High-Level Assigned Work (Priority: P1)

As a team lead, I want to select a configured team or searched users and see the
active Redmine tickets they are working on so I can understand current
high-level work distribution.

**Why this priority**: This is the main purpose of the new dashboard: seeing
active assigned work, not only logged time after the fact.

**Independent Test**: Can be tested by selecting a specific team and one or more
searched users, then confirming only working-state assigned tickets for the
selected people are summarized.

**Acceptance Scenarios**:

1. **Given** Work Overview is open, **When** the user selects a configured team,
   **Then** only users assigned to that team are included.
2. **Given** Work Overview is open, **When** the user searches and selects users,
   **Then** only those selected users are included.
3. **Given** Redmine returns tickets assigned to selected users, **When** the
   board renders, **Then** New, Closed, On hold, Staged, and Testing Rejected
   tickets are excluded from working ticket counts and per-user ticket lists.
4. **Given** a selected user has working tickets, **When** the per-user section
   renders, **Then** each ticket shows ticket description/subject, tracker,
   priority, start date, and due/end date when available.
5. **Given** the selected scope has working tickets, **When** the summary renders,
   **Then** it shows total working tickets and the number of selected people who
   actively have at least one working ticket.

#### Post-T077 Product Direction Update

After implementation feedback, Work Overview is intentionally tuned for the
team lead's real scanning flow:

- Work Overview is the default view because this is now the main dashboard.
- Scope selection is limited to configured Team or searched/selected Users.
  Full Team mode is removed to avoid an accidental noisy default.
- User search starts empty and only shows selected users until the user searches
  for more people. Selected users remain visible so the filter feels anchored.
- Team settings are backed by `team-config.local.json` through the local proxy,
  not only by copy/paste JSON.
- Settings loads all active Redmine users, supports search, and keeps selected
  team members at the top of each team editor.
- Working tickets exclude New, Closed, On hold, Staged, and Testing Rejected.
- Compact ticket cards are the default. They use approved natural-language copy
  from `data/work-overview-phrases.json` above the issue title, then show
  priority, dates, due-date signal, and logged-vs-estimated time.
- A default-off "Show detailed ticket" checkbox restores the fuller tracker,
  status, project, and metadata layout when the user wants inspection mode.

---

### User Story 9 - Use Weekly And Monthly Time Log Periods (Priority: P1)

As a team lead, I want the Time Logs view to focus on Last Week, Last Month,
This Month, and Custom Range so the dashboard matches the team's weekly logging
habit instead of implying daily logging is expected.

**Why this priority**: The period presets should match how developers actually
log time, otherwise the default view will often appear empty or misleading.

**Independent Test**: Can be tested by opening Time Logs and confirming Today
and Yesterday are no longer visible while Last Week, Last Month, This Month, and
Custom Range are available and calculate correct date ranges.

**Acceptance Scenarios**:

1. **Given** Time Logs is open, **When** the user opens the period selector,
   **Then** Today and Yesterday are not shown.
2. **Given** Time Logs is open, **When** the user selects Last Month,
   **Then** summaries use the previous calendar month.
3. **Given** Time Logs is open, **When** the user selects This Month,
   **Then** summaries use the current calendar month through today.

### Edge Cases

- Custom range start date is after the end date.
- Custom range is valid but contains no time entries for the selected team.
- A selected period contains more than five activities for one member.
- Multiple entries map to the same issue and should be grouped for the tile.
- Redmine issue estimates are missing, zero, or lower than logged time.
- A selected team member exists in configuration but is not returned by Redmine.
- Redmine returns time entries without issue references, comments, or project
  details.
- Redmine issues are assigned to configured users but have New, Closed, On hold,
  Staged, or Testing Rejected status.
- Redmine issues use an unexpected status name not listed in the known statuses.
- A configured team has no assigned users.
- A user belongs to multiple configured teams.
- Settings edits produce duplicate team names or duplicate user assignments.
- The local proxy is unavailable when the user tries to save team JSON to
  `team-config.local.json`.
- Multiple entries share the same timestamp or cannot be reliably ordered.
- The local proxy is running but returns a non-JSON response or authentication
  error.
- Redmine pagination hides some team data unless all pages are fetched.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST show every selected team member in the primary
  dashboard, even when no activity data is available for that member.
- **FR-002**: System MUST provide a period selector with Today, Yesterday, This
  Week, Last Week, and Custom Range options.
- **FR-003**: System MUST apply the selected period to all member summaries,
  totals, activity lists, and detail views.
- **FR-004**: System MUST validate custom start/end dates and show a clear error
  when the range is invalid.
- **FR-005**: System MUST display up to five activity or ticket rows per member
  tile for the selected period.
- **FR-006**: System MUST group multiple time entries for the same member and
  issue into a single tile activity row when possible.
- **FR-007**: Each tile activity row MUST show project, issue or fallback label,
  activity/summary label, and spent time for the selected period.
- **FR-008**: System MUST show total time spent by each member across all
  activities in the selected period.
- **FR-009**: System MUST show estimated remaining time across the displayed or
  grouped tickets when Redmine estimate data is available.
- **FR-010**: System MUST visibly mark remaining-time values as estimated,
  partial, or unknown based on available Redmine issue estimates.
- **FR-011**: System MUST show a clear fallback state when a member has no
  activity in the selected period, stale activity, or insufficient estimate data.
- **FR-012**: Users MUST be able to open a member detail view from a tile.
- **FR-013**: The member detail view MUST show the selected period, all activity
  rows for that member, total spent time, remaining estimate details, and a
  close/back action.
- **FR-014**: System MUST allow the user to refresh activity data on demand.
- **FR-015**: System MUST show the last successful update time.
- **FR-016**: System MUST show loading, empty, partial, and error states for
  Redmine or proxy data retrieval.
- **FR-017**: System MUST retrieve Redmine data through a local proxy or other
  non-browser credential boundary.
- **FR-018**: System MUST NOT expose Redmine API keys or private credentials in
  browser-readable source.
- **FR-019**: System MUST support a configurable selected-team list without
  requiring code changes to core dashboard logic.
- **FR-020**: System SHOULD allow filtering or grouping by activity status so the
  user can quickly find available, inactive, or attention-needed members.
- **FR-021**: System SHOULD avoid requiring a build step for normal local use.

### Next Scope Functional Requirements

- **FR-022**: System MUST provide a top-level view selector with at least Time
  Logs and Work Overview options.
- **FR-023**: System MUST show only the controls relevant to the currently
  selected view.
- **FR-024**: System MUST provide a Work Overview settings action that opens a
  team configuration view.
- **FR-025**: Team configuration MUST support creating teams, renaming teams,
  removing teams, and assigning configured users to teams.
- **FR-026**: Team configuration MUST be representable as JSON in the local
  browser configuration file.
- **FR-027**: System MUST allow Work Overview selection by one configured team
  or searched/selected users. Full Team mode is intentionally not exposed in the
  current UI.
- **FR-028**: System MUST define working tickets as Redmine issues assigned to
  selected users whose status is not New, Closed, On hold, Staged, or Testing
  Rejected.
- **FR-029**: System MUST support the following known Redmine statuses for
  display and filtering: On hold, New, Development Ready, Design,
  Implementation, Review, Testing, Staged, Testing Ready, Testing Rejected,
  Closed, and In Progress.
- **FR-030**: Work Overview MUST show total working ticket count for the selected
  scope.
- **FR-031**: Work Overview MUST show the number of selected people who actively
  have at least one working ticket.
- **FR-032**: Work Overview MUST show each selected user's working tickets with
  ticket description/subject, tracker, priority, start date, and due/end date
  when Redmine provides those fields.
- **FR-033**: Work Overview MUST keep selected users visible even when they have
  no working tickets.
- **FR-034**: System MUST retrieve issue assignment, status, tracker, priority,
  start date, and due date through the local proxy credential boundary.
- **FR-035**: The Time Logs view MUST replace Today and Yesterday with Last
  Month and This Month in the visible period selector, leaving Last Week and
  Custom Range available.
- **FR-036**: Work Overview MUST default to compact ticket cards that display an
  approved natural-language activity phrase from JSON, issue title, priority,
  dates, due-date signal, and logged-vs-estimated time.
- **FR-037**: Work Overview MUST provide a default-off "Show detailed ticket"
  checkbox that restores tracker, status, project, and detailed ticket metadata.
- **FR-038**: Team settings MUST persist to a local JSON file through the local
  proxy when the save endpoint is available.
- **FR-039**: Work Overview issue links MUST use the configured Redmine base URL,
  not the local dashboard origin.

### Key Entities *(include if feature involves data)*

- **Selected Period**: The active date scope for the dashboard. Key attributes
  include preset, start date, end date, display label, and validation state.
- **Team Member**: A selected person whose activity should appear on the
  dashboard. Key attributes include Redmine user identifier, display name, and
  inclusion status.
- **Activity Row**: A grouped work item for a member in the selected period. Key
  attributes include project, issue, activity label, comments/summary, spent
  time, latest activity time, estimate hours, remaining hours, and whether the
  estimate is complete.
- **Member Period Summary**: A per-member summary for the selected period. Key
  attributes include total spent time, up to five visible activity rows, hidden
  activity count, activity status, remaining estimate summary, and warnings.
- **Activity Status**: A human-readable state derived from available period data,
  such as active, recently active, inactive for period, no data, or needs
  attention.
- **Member Detail View**: A drill-down state for one member and period, including
  all activity rows and estimate details.
- **Refresh State**: The dashboard's current data-loading condition, including
  loading, successful, empty, partial, failed, and last successful update time.

### Next Scope Key Entities

- **Dashboard View**: The active product mode. Key attributes include view key,
  display label, active filters, and view-specific loading state.
- **Configured Team**: A locally configured group of team members. Key
  attributes include team identifier, name, and assigned member identifiers.
- **Work Scope Selection**: The selected Work Overview population. Key
  attributes include scope type, selected team identifier, selected member
  identifiers, and search query.
- **Redmine Work Ticket**: A Redmine issue assigned to a selected member. Key
  attributes include issue identifier, subject/description, tracker, status,
  priority, assignee, start date, due date, and whether it is a working ticket.
- **Work Overview Summary**: Aggregated state for selected work scope, including
  total working tickets, active people count, per-user ticket groups, and
  excluded-status counts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can switch between Today, Yesterday, This Week, Last Week,
  and Custom Range and see updated team summaries within 15 seconds under normal
  network conditions.
- **SC-002**: A user can identify every selected team member's top activities for
  the selected period within 30 seconds of opening or changing the dashboard.
- **SC-003**: For at least 90% of selected team members with Redmine time entries
  in the selected period, the dashboard shows up to five activity rows, total
  spent time, and period-scoped status without requiring navigation to Redmine.
- **SC-004**: The dashboard clearly identifies members with no activity or
  unavailable data for 100% of selected team members.
- **SC-005**: A manual refresh completes with either updated data or a visible
  error state within 15 seconds under normal network conditions.
- **SC-006**: No Redmine API key or private credential is present in
  browser-readable source files.
- **SC-007**: A user can open and close a member detail view in under 5 seconds
  while preserving the selected period.
- **SC-008**: The MVP can be run locally by following project instructions in
  under 10 minutes after the required Redmine credentials are available.

### Next Scope Success Criteria

- **SC-009**: A user can switch between Time Logs and Work Overview in under 3
  seconds without losing the current browser-session filters for either view.
- **SC-010**: A user can configure at least three local teams and assign users to
  them, then use those teams in Work Overview filtering without changing core
  application code.
- **SC-011**: For a selected Work Overview scope, the dashboard shows total
  working tickets, active people count, and per-user working ticket lists within
  15 seconds under normal network conditions.
- **SC-012**: New, Closed, On hold, Staged, and Testing Rejected tickets are
  excluded from working-ticket totals and per-user working lists 100% of the
  time when status data is available.
- **SC-013**: A user can choose Last Week, Last Month, This Month, or Custom
  Range in the Time Logs view without seeing Today or Yesterday options.

## Assumptions

- The first version remains for local/internal use by the project owner or team
  lead, not a multi-user hosted product.
- Redmine time entries remain the primary signal for current or recent work.
- "Current activity" means the latest meaningful Redmine activity observed
  within the selected period, not a guaranteed real-time presence signal.
- Remaining time is an estimate based on Redmine issue estimated hours when
  available; it is partial or unknown when estimate data is missing.
- For tiles, multiple entries for the same issue should be grouped before
  choosing the five visible activities.
- Custom ranges are inclusive of both start and end dates.
- Selected team members can be configured from a simple local configuration file
  or generated list.

### Next Scope Assumptions

- Redmine assigned issues are the primary signal for the Work Overview view.
- Team configuration can be edited in the UI and represented as JSON for the
  local config file; automatically writing that file from a static browser page
  is outside the first implementation unless a safe local helper is added.
- Productivity factors, rankings, historical forecasting, and comparative
  scoring remain outside this scope.

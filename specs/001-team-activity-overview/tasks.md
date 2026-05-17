# Tasks: Team Activity Overview

**Input**: Design documents from `/specs/001-team-activity-overview/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: No formal TDD tasks requested. Verification is captured as manual browser/proxy smoke tasks in the polish phase.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and does not depend on incomplete tasks
- **[Story]**: Which user story the task belongs to, only used in user-story phases
- Every task includes an exact repository path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the flat static app structure and safe local configuration pattern from the implementation plan.

- [X] T001 Create dashboard HTML shell with app regions in `/Users/inosh/repos/codex/team-highlevel-view/index.html`
- [X] T002 [P] Create modern responsive base styling and status color tokens in `/Users/inosh/repos/codex/team-highlevel-view/styles.css`
- [X] T003 [P] Create empty ES module app entry with initialization placeholder in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T004 [P] Create safe sample selected-team and proxy configuration in `/Users/inosh/repos/codex/team-highlevel-view/config.example.js`
- [X] T005 Create local config git-ignore rules for `config.local.js`, `.env`, and macOS noise in `/Users/inosh/repos/codex/team-highlevel-view/.gitignore`
- [X] T006 Create proxy dependency list in `/Users/inosh/repos/codex/team-highlevel-view/requirements.txt`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the proxy, configuration loading, and shared data normalization needed by all user stories.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T007 Implement environment-based Redmine proxy configuration in `/Users/inosh/repos/codex/team-highlevel-view/proxy.py`
- [X] T008 Implement proxy CORS, `OPTIONS`, and read-only allowlist for `/time_entries.json`, `/users.json`, and `/issues/{id}.json` in `/Users/inosh/repos/codex/team-highlevel-view/proxy.py`
- [X] T009 Implement proxy error responses that preserve useful status information without exposing credentials in `/Users/inosh/repos/codex/team-highlevel-view/proxy.py`
- [X] T010 Implement browser config loading from `window.TEAM_ACTIVITY_CONFIG` with fallback defaults in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T011 Implement selected-team validation for unique numeric IDs, non-empty names, and active-member filtering in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T012 Implement Redmine fetch helper with JSON validation, HTTP error handling, and timeout handling in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T013 Implement time-entry pagination support for Redmine list responses in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T014 Implement date/time formatting helpers for current working day and last activity display in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T015 Add script and stylesheet wiring for config, app module, and CSS in `/Users/inosh/repos/codex/team-highlevel-view/index.html`

**Checkpoint**: Proxy, config, fetch, validation, pagination, and base page wiring are ready for story work.

---

## Phase 3: User Story 1 - See Current Team Activity (Priority: P1) MVP

**Goal**: Show every configured team member with today's latest Redmine-derived activity, project/issue context, daily logged time, last activity time, and an activity status.

**Independent Test**: Load the dashboard with configured team members and confirm every member appears; members with today's entries show latest activity details and members without entries show a no-activity state.

### Implementation for User Story 1

- [X] T016 [US1] Implement Redmine time-entry loading for every selected member for the current working day in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T017 [US1] Implement Redmine time-entry normalization into `RedmineTimeEntry` objects in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T018 [US1] Implement latest-observation selection using `updated_on`, then `created_on`, then `spent_on` ordering in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T019 [US1] Implement daily activity summary creation with one summary per selected team member in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T020 [US1] Implement activity status derivation for `active`, `recently-active`, `inactive-today`, `no-data`, and `needs-attention` in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T021 [US1] Implement dashboard header, current date, and status count rendering in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T022 [US1] Implement team member card rendering with name, status, latest summary, project, issue, total hours today, and last activity in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T023 [US1] Style team board layout, member cards, status badges, and responsive mobile layout in `/Users/inosh/repos/codex/team-highlevel-view/styles.css`
- [X] T024 [US1] Add empty selected-team and no-activity-today UI copy in `/Users/inosh/repos/codex/team-highlevel-view/index.html`

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Estimate Occupied Time (Priority: P2)

**Goal**: Add visibly labeled occupied-duration estimates or clear duration fallbacks for each member.

**Independent Test**: Use entries with known hours and timestamps, then confirm recent entries show estimated occupied duration while stale or incomplete entries show recently-active, inactive, or duration-unknown states.

### Implementation for User Story 2

- [X] T025 [US2] Implement occupied-duration estimate calculation from latest entry hours and recency in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T026 [US2] Implement estimate confidence and basis labels that distinguish estimates from Redmine facts in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T027 [US2] Implement stale, missing, future-dated, zero-hour, and unusually long entry duration fallbacks in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T028 [US2] Add occupied-duration and warning badge rendering to member cards in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T029 [US2] Style estimate labels, warning badges, and needs-attention states in `/Users/inosh/repos/codex/team-highlevel-view/styles.css`

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Refresh and Recover From Data Issues (Priority: P3)

**Goal**: Let the user refresh dashboard data and clearly understand loading, success, empty, partial failure, and failed refresh states.

**Independent Test**: Load the dashboard, refresh successfully, then stop or misconfigure the proxy and confirm the dashboard shows a failed refresh state without marking stale data as freshly updated.

### Implementation for User Story 3

- [X] T030 [US3] Implement global `RefreshState` transitions for `idle`, `loading`, `success`, `empty`, and `failed` in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T031 [US3] Implement manual refresh button behavior and disable/refreshing state during active fetches in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T032 [US3] Implement last successful update timestamp that changes only after successful summary creation in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T033 [US3] Implement global loading, empty, auth error, proxy connection error, non-JSON error, and partial member failure messages in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T034 [US3] Preserve previously successful summaries as stale when a later refresh fails in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T035 [US3] Style refresh controls, stale markers, loading state, empty state, and error banners in `/Users/inosh/repos/codex/team-highlevel-view/styles.css`

**Checkpoint**: All MVP user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improve documentation, security checks, and local verification across all stories.

- [X] T036 Update implementation quickstart commands and generated file notes in `/Users/inosh/repos/codex/team-highlevel-view/specs/001-team-activity-overview/quickstart.md`
- [X] T037 Add project README with setup, proxy environment variables, local config, and run instructions in `/Users/inosh/repos/codex/team-highlevel-view/README.md`
- [X] T038 Run browser smoke verification for `http://localhost:8000` and document any visual/layout fixes in `/Users/inosh/repos/codex/team-highlevel-view/specs/001-team-activity-overview/quickstart.md`
- [X] T039 Run proxy smoke verification for allowed and blocked paths and document results in `/Users/inosh/repos/codex/team-highlevel-view/specs/001-team-activity-overview/quickstart.md`
- [X] T040 Search browser-readable files for Redmine credential strings and document the security check in `/Users/inosh/repos/codex/team-highlevel-view/specs/001-team-activity-overview/quickstart.md`
- [X] T041 Review `referance/` usage and confirm no wholesale reference dashboard copy was introduced in `/Users/inosh/repos/codex/team-highlevel-view/specs/001-team-activity-overview/quickstart.md`
- [X] T042 Validate final UI text fits on mobile and desktop widths and adjust CSS in `/Users/inosh/repos/codex/team-highlevel-view/styles.css`

---

## Phase 7: Period-Based Activity Expansion (New Scope)

**Purpose**: Extend the completed MVP with period selection, up to five grouped activities per tile, total spent/remaining estimates, and a member detail view.

**Independent Test**: Select Today, Yesterday, This Week, Last Week, and a valid Custom Range; confirm every member tile updates for that period, lists up to five grouped activities, shows total spent and remaining estimate state, and opens a detail view with the full activity list.

### User Story 1 - Review Team Activity By Period (Priority: P1)

- [X] T043 [US1] Add period selector markup for Today, Yesterday, This Week, Last Week, and Custom Range in `/Users/inosh/repos/codex/team-highlevel-view/index.html`
- [X] T044 [P] [US1] Style period selector, custom range inputs, validation message, and compact mobile layout in `/Users/inosh/repos/codex/team-highlevel-view/styles.css`
- [X] T045 [US1] Implement `SelectedPeriod` state, preset date calculations, and inclusive custom range validation in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T046 [US1] Change Redmine time-entry loading from `spent_on` today to selected-period `from` and `to` parameters in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T047 [US1] Apply selected period label and no-activity-for-period fallback text to dashboard header, notice, and member cards in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T048 [US1] Close or refresh any open member detail view when the selected period changes in `/Users/inosh/repos/codex/team-highlevel-view/app.js`

### User Story 2 - Scan Up To Five Activities Per Person (Priority: P1)

- [X] T049 [US2] Replace single latest-observation summary with grouped `ActivityRow` creation by issue ID or project/activity/comments fallback in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T050 [US2] Sort grouped activity rows by latest activity timestamp then spent hours in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T051 [US2] Render up to five activity rows per member tile with issue/fallback label, project, activity summary, and spent time in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T052 [US2] Render hidden activity count when a member has more than five grouped rows in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T053 [P] [US2] Style activity row list, row metadata, hidden-count hint, and empty-period tile state in `/Users/inosh/repos/codex/team-highlevel-view/styles.css`

### User Story 3 - See Spent And Remaining Estimate Per Person (Priority: P2)

- [X] T054 [US3] Extend proxy allowlist and response handling for `/issues/{id}.json` estimated-hours lookups in `/Users/inosh/repos/codex/team-highlevel-view/proxy.py`
- [X] T055 [US3] Add cached Redmine issue-detail fetching for grouped activity rows with issue IDs in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T056 [US3] Normalize Redmine issue subject, status, and estimated hours into row estimate data in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T057 [US3] Calculate total spent hours for each member across all period activity rows in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T058 [US3] Calculate member remaining estimate summary with `known`, `partial`, `unknown`, and `over-estimate` states in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T059 [US3] Render total spent, remaining estimate label, and estimate-state warnings on each member tile in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T060 [P] [US3] Style total/remaining estimate blocks and partial/unknown/over-estimate visual states in `/Users/inosh/repos/codex/team-highlevel-view/styles.css`

### User Story 4 - Inspect A Team Member Detail View (Priority: P3)

- [X] T061 [US4] Add member detail view container, close action, and accessible labels in `/Users/inosh/repos/codex/team-highlevel-view/index.html`
- [X] T062 [US4] Open the detail view when a member tile is clicked while preserving selected period and status filter state in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T063 [US4] Render full member activity row list, selected period, total spent, remaining estimate details, and warnings in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T064 [US4] Implement close/back behavior for the detail view in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T065 [P] [US4] Style detail view panel/modal, activity table/list, totals, warnings, and mobile layout in `/Users/inosh/repos/codex/team-highlevel-view/styles.css`

### User Story 5 - Refresh And Recover From Data Issues (Priority: P4)

- [X] T066 [US5] Update refresh state logic so manual refresh reloads the currently selected period and marks stale period data correctly in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T067 [US5] Add partial refresh handling for failed member or issue-estimate lookups without hiding successfully loaded members in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T068 [US5] Update status counts and filtering to include `inactive-period`, `no-data`, and `needs-attention` for selected-period summaries in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T069 [US5] Update global empty/error/partial messages for invalid custom range, no entries in period, proxy failure, and missing estimates in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T070 [P] [US5] Style partial refresh, invalid range, and stale period states in `/Users/inosh/repos/codex/team-highlevel-view/styles.css`

### Polish And Verification For Expansion

- [X] T071 Update setup and usage docs for period selector, custom range, issue estimate lookup, and member detail view in `/Users/inosh/repos/codex/team-highlevel-view/README.md`
- [X] T072 Update quickstart verification steps for period presets, custom range, five-row tiles, estimates, detail view, and partial failures in `/Users/inosh/repos/codex/team-highlevel-view/specs/001-team-activity-overview/quickstart.md`
- [X] T073 Run JavaScript and Python syntax checks for expanded files and document results in `/Users/inosh/repos/codex/team-highlevel-view/specs/001-team-activity-overview/quickstart.md`
- [X] T074 Run live proxy smoke checks for `/time_entries.json?from=...&to=...` and `/issues/{id}.json` and document results in `/Users/inosh/repos/codex/team-highlevel-view/specs/001-team-activity-overview/quickstart.md`
- [X] T075 Run browser smoke checks for desktop and mobile period selector, tile rows, and detail view; save screenshots under `/Users/inosh/repos/codex/team-highlevel-view/specs/001-team-activity-overview/`
- [X] T076 Search browser-readable files for real Redmine credentials after the expansion and document the security check in `/Users/inosh/repos/codex/team-highlevel-view/specs/001-team-activity-overview/quickstart.md`

---

## Phase 8: Multi-View Work Overview Addendum (New Scope)

**Purpose**: Append the next dashboard layer without rewriting completed MVP
tasks. This phase adds Time Logs period preset changes, top-level view switching,
local team configuration, and a Work Overview dashboard for active assigned
Redmine tickets.

**Independent Test**: Switch between Time Logs and Work Overview; confirm Time
Logs exposes only Last Week, Last Month, This Month, and Custom Range; configure
teams in settings; select a configured team and searched users; then confirm
Work Overview shows total working tickets, active people count, and per-user
working tickets excluding New, Closed, On hold, Staged, and Testing Rejected
statuses.

### User Story 9 - Adjust Time Logs Period Presets (Priority: P1)

- [X] T077 [US9] Replace visible Time Logs period options with Last Week, Last Month, This Month, and Custom Range in `/Users/inosh/repos/codex/team-highlevel-view/index.html`
- [X] T078 [US9] Update selected-period preset calculations to support `last-month` and `this-month` while preserving custom range behavior in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T079 [US9] Remove Today and Yesterday from Time Logs UI copy, empty states, and documentation references in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T080 [P] [US9] Adjust responsive period-control styling if the new labels wrap poorly in `/Users/inosh/repos/codex/team-highlevel-view/styles.css`

### User Story 6 - Switch Between Dashboard Views (Priority: P1)

- [X] T081 [US6] Add top-level dashboard view selector markup with Time Logs and Work Overview options in `/Users/inosh/repos/codex/team-highlevel-view/index.html`
- [X] T082 [US6] Add `DashboardView` state and preserve separate filter state for each view during the browser session in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T083 [US6] Render only active-view controls and board regions when the selected view changes in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T084 [US6] Route manual refresh to the active view's data loader without disturbing the inactive view in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T085 [P] [US6] Style the view selector and active-view layout states in `/Users/inosh/repos/codex/team-highlevel-view/styles.css`

### User Story 7 - Configure Teams Locally (Priority: P2)

- [X] T086 [US7] Extend sample browser config with `teams` JSON examples in `/Users/inosh/repos/codex/team-highlevel-view/config.example.js`
- [X] T087 [US7] Add Work Overview settings button and team configuration panel/container in `/Users/inosh/repos/codex/team-highlevel-view/index.html`
- [X] T088 [US7] Validate configured teams for unique IDs/names and member IDs that exist in the configured team list in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T089 [US7] Render team list, team create/rename/remove controls, and user assignment controls in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T090 [US7] Generate an exportable JSON config snippet from team settings edits in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T091 [P] [US7] Style the settings panel, team list, user assignment controls, and JSON preview in `/Users/inosh/repos/codex/team-highlevel-view/styles.css`

### User Story 8 - Review High-Level Assigned Work (Priority: P1)

- [X] T092 [US8] Extend proxy allowlist for read-only `/issues.json` assigned-issue list queries in `/Users/inosh/repos/codex/team-highlevel-view/proxy.py`
- [X] T093 [US8] Implement paginated Redmine issue-list loading by assigned user for Work Overview in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T094 [US8] Normalize Redmine issues into `RedmineWorkTicket` objects with subject, tracker, status, priority, assignee, start date, and due date in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T095 [US8] Implement working-ticket filtering that excludes New, Closed, On hold, Staged, and Testing Rejected statuses and flags unknown statuses in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T096 [US8] Add Work Overview scope controls for configured team and searched/selected users in `/Users/inosh/repos/codex/team-highlevel-view/index.html`
- [X] T097 [US8] Resolve Work Overview selected scope into selected member IDs in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T098 [US8] Calculate Work Overview total working tickets, active people count, tickets by member, and excluded-status counts in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T099 [US8] Render Work Overview summary metrics and per-user ticket lists with ticket description, tracker, priority, start date, and due date in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T100 [P] [US8] Style Work Overview scope controls, summary metrics, per-user ticket lists, status/priority labels, and empty states in `/Users/inosh/repos/codex/team-highlevel-view/styles.css`

### Polish And Verification For Work Overview

- [X] T101 Update setup and usage docs for view switching, new Time Logs periods, team config JSON, and Work Overview in `/Users/inosh/repos/codex/team-highlevel-view/README.md`
- [X] T102 Update quickstart verification for Time Logs periods, view switching, settings, Work Overview filters, issue loading, and excluded statuses in `/Users/inosh/repos/codex/team-highlevel-view/specs/001-team-activity-overview/quickstart.md`
- [X] T103 Run JavaScript and Python syntax checks for Work Overview changes and document results in `/Users/inosh/repos/codex/team-highlevel-view/specs/001-team-activity-overview/quickstart.md`
- [X] T104 Run proxy smoke checks for `/issues.json?assigned_to_id=...&status_id=*` and blocked paths, then document results in `/Users/inosh/repos/codex/team-highlevel-view/specs/001-team-activity-overview/quickstart.md`
- [X] T105 Run browser smoke checks for desktop and mobile view switching, settings, team filtering, user search, and Work Overview ticket lists; save screenshots under `/Users/inosh/repos/codex/team-highlevel-view/specs/001-team-activity-overview/`
- [X] T106 Search browser-readable files for Redmine credentials after Work Overview changes and document the security check in `/Users/inosh/repos/codex/team-highlevel-view/specs/001-team-activity-overview/quickstart.md`

### Post-T077 Vibe-Coded Follow-Up: Make Work Overview Feel Real

These tasks capture the iterative fixes made after the initial T077+ Work
Overview implementation. The shape of the app shifted from "technically shows
tickets" to "a lead can glance at it and understand what is actually happening."

- [X] T107 Change Work Overview to the default dashboard view in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T108 Remove Full Team mode from Work Overview scope controls and keep only Team and Users in `/Users/inosh/repos/codex/team-highlevel-view/index.html`
- [X] T109 Clear auto-selected users when switching to Users mode so no user is silently ticked in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T110 Persist team settings to `team-config.local.json` through proxy `GET`/`POST /team-config.json` in `/Users/inosh/repos/codex/team-highlevel-view/proxy.py`
- [X] T111 Load all active Redmine users for team configuration and show selected team users first in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T112 Add settings UX improvements: accordion team editors, search within users, JSON-click team opening, and reliable multi-team saving in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T113 Exclude On hold, Testing Rejected, and Staged from working-ticket lists and keep New/on-hold count as the non-working stat in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T114 Add Redmine-base issue links and project display using `/proxy-config.json` in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T115 Improve ticket card UX with stronger cards, priority colors, due-date indicators, and logged-vs-estimated time in `/Users/inosh/repos/codex/team-highlevel-view/styles.css`
- [X] T116 Create the reviewed compact copy matrix workbook in `/Users/inosh/repos/codex/team-highlevel-view/outputs/work-overview-copy/work_overview_phrase_matrix.xlsx`
- [X] T117 Convert the approved copy matrix into `/Users/inosh/repos/codex/team-highlevel-view/data/work-overview-phrases.json` and remove Staged from the phrase set
- [X] T118 Add default-off "Show detailed ticket" toggle and compact ticket rendering that uses JSON phrases in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T119 Change user search to show selected users by default and search results only while typing in `/Users/inosh/repos/codex/team-highlevel-view/app.js`
- [X] T120 Verify compact mode, detailed mode, selected-user search behavior, syntax checks, and browser console health for Work Overview

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion; delivers the MVP board.
- **User Story 2 (Phase 4)**: Depends on User Story 1 summaries and card rendering.
- **User Story 3 (Phase 5)**: Depends on Foundational fetch helpers and benefits from User Story 1 rendering.
- **Polish (Phase 6)**: Depends on implemented stories selected for delivery.
- **Period Expansion (Phase 7)**: Depends on completed MVP tasks T001-T042 and should be implemented in task order T043-T076.
- **Work Overview Addendum (Phase 8)**: Depends on completed period expansion T043-T076 and should be implemented in task order T077-T106.

### User Story Dependencies

- **US1 - See Current Team Activity**: Required MVP slice; no dependency on US2 or US3 after foundation.
- **US2 - Estimate Occupied Time**: Depends on US1's latest observation and summary model.
- **US3 - Refresh and Recover From Data Issues**: Depends on foundation and can be implemented after US1 to verify real UI behavior.
- **Expansion US1 - Review Team Activity By Period**: Starts the new scope and must complete before grouped tile rows and detail view are reliable.
- **Expansion US2 - Scan Up To Five Activities Per Person**: Depends on selected-period fetching and grouping.
- **Expansion US3 - See Spent And Remaining Estimate Per Person**: Depends on grouped rows and issue-detail lookup.
- **Expansion US4 - Inspect A Team Member Detail View**: Depends on grouped rows and estimate summaries.
- **Expansion US5 - Refresh And Recover From Data Issues**: Depends on the expanded period and estimate state model.
- **US9 - Adjust Time Logs Period Presets**: Can be implemented first because it modifies the existing period controls only.
- **US6 - Switch Between Dashboard Views**: Depends on US9 only for final period labels, but can be built around existing Time Logs rendering.
- **US7 - Configure Teams Locally**: Depends on US6 because settings belongs to Work Overview controls.
- **US8 - Review High-Level Assigned Work**: Depends on US6 for view routing and benefits from US7 team config; the current implementation intentionally exposes Team and Users modes only.

### Within Each User Story

- Data loading and normalization before summary derivation.
- Summary derivation before UI rendering.
- UI rendering before visual styling polish.
- Refresh state logic before error/stale display styling.

### Parallel Opportunities

- T002, T003, T004, and T006 can run in parallel during setup.
- T007-T009 can be implemented in `proxy.py` while T010-T014 are implemented in `app.js`, after setup files exist.
- T021 and T023 can be refined in parallel after T019-T020 define the summary/status shape.
- T025-T027 can be worked together in `app.js` before T028 integrates display.
- T036 and T037 can run in parallel after the app shape is stable.
- T044 can run in parallel with T045 after T043 adds period-selector markup.
- T053 can run in parallel with T049-T052 once the activity row shape is agreed.
- T060 can run in parallel with T055-T059 after estimate state names are set.
- T065 can run in parallel with T062-T064 after T061 adds the detail container.
- T070 can run in parallel with T066-T069 after refresh state names are set.
- T080 can run in parallel with T078-T079 after T077 updates the period options.
- T085 can run in parallel with T082-T084 after T081 adds the view selector.
- T091 can run in parallel with T088-T090 after T087 adds the settings container.
- T100 can run in parallel with T093-T099 after T096 defines the Work Overview controls.

---

## Parallel Example: User Story 1

```bash
Task: "T016 [US1] Implement Redmine time-entry loading for every selected member for the current working day in /Users/inosh/repos/codex/team-highlevel-view/app.js"
Task: "T023 [US1] Style team board layout, member cards, status badges, and responsive mobile layout in /Users/inosh/repos/codex/team-highlevel-view/styles.css"
```

## Parallel Example: User Story 2

```bash
Task: "T025 [US2] Implement occupied-duration estimate calculation from latest entry hours and recency in /Users/inosh/repos/codex/team-highlevel-view/app.js"
Task: "T029 [US2] Style estimate labels, warning badges, and needs-attention states in /Users/inosh/repos/codex/team-highlevel-view/styles.css"
```

## Parallel Example: User Story 3

```bash
Task: "T033 [US3] Implement global loading, empty, auth error, proxy connection error, non-JSON error, and partial member failure messages in /Users/inosh/repos/codex/team-highlevel-view/app.js"
Task: "T035 [US3] Style refresh controls, stale markers, loading state, empty state, and error banners in /Users/inosh/repos/codex/team-highlevel-view/styles.css"
```

## Parallel Example: Period Expansion

```bash
Task: "T045 [US1] Implement SelectedPeriod state, preset date calculations, and inclusive custom range validation in /Users/inosh/repos/codex/team-highlevel-view/app.js"
Task: "T044 [P] [US1] Style period selector, custom range inputs, validation message, and compact mobile layout in /Users/inosh/repos/codex/team-highlevel-view/styles.css"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational proxy, config, fetch, and data helpers.
3. Complete Phase 3: User Story 1.
4. Stop and validate: every selected member appears with current-day activity or a no-activity state.

### Incremental Delivery

1. Deliver US1 for basic high-level team visibility.
2. Add US2 for occupied-duration estimates and warning states.
3. Add US3 for refresh, stale-data, loading, and error recovery behavior.
4. Complete polish checks before treating the MVP as ready.

### Suggested MVP Scope

The first demonstrable MVP is Phase 1 + Phase 2 + Phase 3. This gives the team
activity board without duration estimates or full refresh recovery polish.

### Period Expansion First Slice

1. Complete T043-T048 to make the dashboard period-aware.
2. Complete T049-T053 to show up to five grouped activities per tile.
3. Stop and validate period switching plus grouped tile display before adding
   remaining estimates and the detail view.

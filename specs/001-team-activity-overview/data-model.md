# Data Model: Team Activity Overview

## SelectedPeriod

Represents the active date scope for every dashboard calculation.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `preset` | enum | yes | `today`, `yesterday`, `this-week`, `last-week`, or `custom` |
| `startDate` | date string | yes | Inclusive period start |
| `endDate` | date string | yes | Inclusive period end |
| `label` | string | yes | Human-readable label shown in header and detail view |
| `isValid` | boolean | yes | False when custom range is incomplete or invalid |
| `error` | string | no | User-readable validation issue |

**Validation rules**:
- `startDate` must be on or before `endDate`.
- Presets compute dates from the user's local calendar.
- All member summaries and detail views must be scoped to the same selected
  period.

## TeamMember

Represents a selected person whose activity appears on the dashboard.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | number | yes | Redmine user identifier |
| `name` | string | yes | Display name used in the dashboard |
| `login` | string | no | Optional Redmine login if available |
| `active` | boolean | no | Defaults to `true`; inactive members are hidden from MVP view |

**Validation rules**:
- `id` must be unique in the selected team list.
- `name` must not be empty.
- Invalid or missing members are shown as configuration/data issues rather than
  silently dropped.

## RedmineTimeEntry

Represents one normalized Redmine time-entry record fetched through the proxy.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | number | no | Redmine time-entry identifier when returned |
| `userId` | number | yes | Redmine user identifier |
| `spentOn` | date string | yes | Date of the logged work |
| `hours` | number | yes | Logged hours; zero or unusual values remain visible |
| `projectName` | string | no | Project name from Redmine |
| `issueId` | number | no | Related issue identifier |
| `issueSubject` | string | no | Related issue subject if fetched or returned |
| `activityName` | string | no | Redmine activity/category name |
| `comments` | string | no | User-entered time-entry comments |
| `createdOn` | datetime string | no | Creation timestamp if returned by Redmine |
| `updatedOn` | datetime string | no | Update timestamp if returned by Redmine |

**Validation rules**:
- Entries outside the selected period are excluded from period summaries.
- Entries with missing project, issue, activity, or comments use display
  fallbacks such as `Unknown project` or `No issue`.
- Entries are ordered by the best available timestamp: `updatedOn`, then
  `createdOn`, then `spentOn`.

## RedmineIssueEstimate

Represents issue detail needed to calculate remaining estimated time.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `issueId` | number | yes | Redmine issue identifier |
| `subject` | string | no | Human-readable issue title |
| `statusName` | string | no | Redmine issue status |
| `estimatedHours` | number | no | Redmine issue estimated hours when available |
| `loaded` | boolean | yes | Whether the issue lookup succeeded |
| `error` | string | no | Non-secret lookup failure message |

**Validation rules**:
- Missing `estimatedHours` does not block the row from display.
- Failed issue lookup marks remaining estimate as unknown or partial.
- Issue lookup results are cached by `issueId` during a refresh.

## ActivityRow

Represents a grouped work item for a member in the selected period.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `key` | string | yes | Stable grouping key |
| `memberId` | number | yes | Links to `TeamMember.id` |
| `projectName` | string | yes | Project label or fallback |
| `issueId` | number | no | Redmine issue identifier when present |
| `issueSubject` | string | no | From issue detail or entry fallback |
| `activityName` | string | no | Activity/category label |
| `summary` | string | yes | Human-readable row summary |
| `spentHours` | number | yes | Sum of grouped time entries in selected period |
| `latestActivityAt` | datetime/date string | no | Best timestamp from grouped entries |
| `estimatedHours` | number | no | Redmine estimate when available |
| `remainingHours` | number | no | Max of estimate minus spent, when calculable |
| `estimateState` | enum | yes | `known`, `partial`, `unknown`, or `over-estimate` |
| `entryCount` | number | yes | Number of grouped time entries |
| `warnings` | string[] | yes | Row-level data issues |

**Validation rules**:
- Entries with the same issue ID group into one row.
- Entries without issue ID group by project, activity, and comments fallback.
- Rows sort by latest activity timestamp, then spent hours.
- Tile rendering shows at most five rows; detail rendering shows all rows.

## MemberPeriodSummary

Represents the dashboard-ready card state for one member and selected period.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `member` | TeamMember | yes | Selected member |
| `period` | SelectedPeriod | yes | Active period used for calculations |
| `status` | ActivityStatus | yes | Derived display state |
| `activityRows` | ActivityRow[] | yes | All grouped rows for selected period |
| `visibleActivityRows` | ActivityRow[] | yes | First five rows for tile display |
| `hiddenActivityCount` | number | yes | Count beyond visible rows |
| `totalSpentHours` | number | yes | Sum of all period entries |
| `remainingEstimate` | RemainingEstimateSummary | yes | Member-level estimate state |
| `lastActivityAt` | datetime/date string | no | Latest activity in the selected period |
| `warnings` | string[] | yes | Data/config issues affecting this member |

**Validation rules**:
- One summary is produced for every selected team member.
- `totalSpentHours` defaults to `0`.
- Missing or stale data must change `status`; it must not remove the member from
  the dashboard.

## RemainingEstimateSummary

Represents member-level remaining time across grouped activities.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `label` | string | yes | Display text such as `Estimated 4h remaining` |
| `knownRemainingHours` | number | no | Sum of calculable row remaining values |
| `knownEstimatedHours` | number | no | Sum of known estimates |
| `unknownRowCount` | number | yes | Rows missing usable estimate data |
| `state` | enum | yes | `known`, `partial`, `unknown`, or `over-estimate` |
| `basis` | string | yes | Explanation for estimate source |

**Validation rules**:
- Remaining values must never be displayed as exact confirmed schedules.
- Negative remaining values are displayed as zero or over-estimate warning.
- Missing issue estimates produce partial or unknown state.

## ActivityStatus

Human-readable state derived from period data freshness.

| Value | Meaning |
|-------|---------|
| `active` | Latest period observation is recent enough to imply current work |
| `recently-active` | Period activity exists but is not recent enough to imply current work |
| `inactive-period` | No activity exists for the member in the selected period |
| `no-data` | Member data could not be loaded or member was not returned |
| `needs-attention` | Data is contradictory, unusually long, missing estimates, or otherwise suspicious |

**State transitions**:
- Period change moves dashboard to loading, then recalculates every summary.
- Manual refresh may move any member between statuses based on newest data.
- Failed refresh preserves previous summaries but marks the global refresh state
  as failed/stale.

## MemberDetailView

Represents the selected drill-down state.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `memberId` | number | yes | Selected member |
| `period` | SelectedPeriod | yes | Period shown in the detail view |
| `activityRows` | ActivityRow[] | yes | All rows for the member and period |
| `isOpen` | boolean | yes | Detail visibility |

**Validation rules**:
- Detail view must close or refresh when the selected period changes.
- Detail totals must match the member tile totals for the same period.

## RefreshState

Represents dashboard-level data freshness.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `state` | enum | yes | `idle`, `loading`, `success`, `empty`, `partial`, or `failed` |
| `startedAt` | datetime string | no | Current refresh start |
| `lastSuccessfulAt` | datetime string | no | Last completed refresh |
| `message` | string | no | User-readable status or error |

**Validation rules**:
- A failed refresh must not overwrite `lastSuccessfulAt`.
- Error messages must be useful without exposing credentials.

## Append-Only Data Model Addendum: Multi-View Work Overview

The following entities extend the existing time-log model for the next dashboard
view. They append new model concepts without replacing the implemented period
summary model above.

## DashboardView

Represents the active dashboard mode.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `key` | enum | yes | `time-logs` or `work-overview` |
| `label` | string | yes | User-facing view name |
| `activeFilters` | object | yes | View-specific filter state retained during the browser session |
| `refreshState` | RefreshState | yes | Loading state for the active view |

**Validation rules**:
- Only controls belonging to the active view should be visible.
- Switching views must not mutate the other view's current filters.

## ConfiguredTeam

Represents a locally configured team that groups Redmine users.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | Stable config identifier such as `platform-team` |
| `name` | string | yes | Display name |
| `memberIds` | number[] | yes | Redmine user IDs assigned to the team |

**Validation rules**:
- `id` values must be unique.
- `name` must not be empty.
- `memberIds` must reference configured team members.
- Empty teams remain valid but show an empty state in filters.

## TeamConfigDraft

Represents edits made in the settings view before the user applies or exports
configuration JSON.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `teams` | ConfiguredTeam[] | yes | Edited team list |
| `selectedTeamId` | string | no | Team currently being edited |
| `isDirty` | boolean | yes | True when edits differ from loaded config |
| `errors` | string[] | yes | Validation errors such as duplicate names |
| `exportJson` | string | no | Generated JSON snippet for the local config |
| `persistTarget` | string | no | Local JSON filename, currently `team-config.local.json` |

**Validation rules**:
- Duplicate team IDs or names must be flagged before applying.
- Team edits may be persisted through the local proxy when `/team-config.json`
  is available.

## WorkScopeSelection

Represents the population selected in Work Overview.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `mode` | enum | yes | `team` or `users` |
| `teamId` | string | no | Required when `mode` is `team` |
| `memberIds` | number[] | no | Required when `mode` is `users` |
| `searchQuery` | string | no | User search text for member selection |
| `showDetailedTickets` | boolean | yes | False by default for compact cards |

**Validation rules**:
- `team` resolves to the selected configured team's members.
- `users` resolves to explicitly selected members after search/filtering.
- Empty user search shows selected users only; search results appear only after
  the user types.

## RedmineWorkTicket

Represents an assigned Redmine issue used by Work Overview.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `issueId` | number | yes | Redmine issue identifier |
| `subject` | string | yes | Issue subject or description fallback |
| `tracker` | string | no | Redmine tracker name |
| `status` | string | yes | Redmine status name |
| `priority` | string | no | Redmine priority name |
| `assigneeId` | number | yes | Redmine user ID of assignee |
| `startDate` | date string | no | Redmine start date |
| `dueDate` | date string | no | Redmine due/end date |
| `projectName` | string | yes | Redmine project name for links and compact copy |
| `estimatedHours` | number/null | no | Redmine estimated hours |
| `spentHours` | number/null | no | Redmine spent hours |
| `isWorking` | boolean | yes | False for New, Closed, On hold, Staged, and Testing Rejected statuses |
| `warnings` | string[] | yes | Missing or unrecognized field notes |

**Validation rules**:
- Tickets with `New`, `Closed`, `On hold`, `Staged`, or `Testing Rejected`
  status are excluded from working-ticket lists.
- Unknown statuses are treated as working and flagged for review.
- Tickets with missing optional fields remain visible with clear fallbacks.

## WorkOverviewPhraseConfig

Represents the reviewed copy matrix used by compact Work Overview cards.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `projectToken` | string | yes | Placeholder token, currently `{project}` |
| `excludedStatuses` | string[] | yes | Non-working statuses shared with filtering |
| `phrases` | object | yes | Nested `status -> tracker -> phrase template` map |

**Validation rules**:
- `Staged` must not appear as a compact phrase status.
- Each supported working status/tracker combination should have natural-language
  copy that makes sense to a reader without showing raw tracker/status fields.
- Missing tracker copy falls back to the `None` tracker phrase.

## WorkOverviewSummary

Represents the rendered state for a Work Overview scope.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `scope` | WorkScopeSelection | yes | Active selected scope |
| `totalWorkingTickets` | number | yes | Count of included working tickets |
| `activePeopleCount` | number | yes | Selected users with at least one working ticket |
| `ticketsByMember` | object | yes | Map of member ID to RedmineWorkTicket[] |
| `excludedStatusCounts` | object | yes | Counts for excluded statuses such as New, On hold, Closed, Staged, and Testing Rejected |
| `warnings` | string[] | yes | Scope-level data issues |

**Validation rules**:
- Every selected member must appear even with zero working tickets.
- Summary counts must be derived only from tickets in working states.

# Contract: UI States

## Primary Dashboard

The first screen is the activity board. It must show:

- Page title
- Period selector with Today, Yesterday, This Week, Last Week, and Custom Range
- Custom range start/end date inputs when Custom Range is selected
- Manual refresh control
- Last successful update time
- Global loading/error/empty/partial status
- Summary counts by activity status
- One card or row for every selected team member

## Period Selector

| Control | Required Behavior |
|---------|-------------------|
| Today | Sets start/end to current local date |
| Yesterday | Sets start/end to previous local date |
| This Week | Sets start/end to current local week |
| Last Week | Sets start/end to previous local week |
| Custom Range | Shows start/end inputs and validates inclusive range |

Invalid custom ranges must show a visible validation error and must not refresh
Redmine data until corrected.

## Team Member Card

Each selected member display must include:

| Element | Required | Fallback |
|---------|----------|----------|
| Member name | yes | Configuration issue if missing |
| Activity status | yes | `no-data` |
| Selected period label | yes | Current preset label |
| Up to five activity rows | yes | `No activity in period` |
| Project per row | when available | `Unknown project` |
| Issue per row | when available | `No issue linked` |
| Activity/summary per row | yes | `Redmine time entry` |
| Spent time per row | yes | `0h` |
| Total spent in period | yes | `0h` |
| Remaining estimate summary | yes | `Remaining unknown` |
| Hidden activity count | when > 5 rows | Hidden when none |
| Warning badge | when needed | Hidden when no warnings |

The card itself must be clickable and open the member detail view.

## Activity Row Display

Tile rows must be compact and scannable:

- Maximum five rows per card
- Rows sorted by latest activity time, then spent time
- Each row shows issue number/label, project, activity or subject, and spent time
- Rows with missing estimate data may show a small partial/unknown estimate hint

## Work Overview Ticket Display

Compact mode is the default Work Overview ticket state:

- Shows approved natural-language activity copy above the issue title
- Shows issue title, priority, start date, due date, due-date signal, and
  logged-vs-estimated time
- Hides raw tracker, status, and project fields because the phrase already
  carries that context
- Keeps the issue number hidden until hover/focus and links it to Redmine

Detailed mode is enabled only when "Show detailed ticket" is checked:

- Restores tracker, status, project, priority, start date, due date, issue link,
  and logged-vs-estimated time
- Uses the same underlying Redmine ticket data as compact mode
- Does not trigger a data reload when toggled

## Member Detail View

The detail view must show:

- Member name
- Selected period label
- Close/back action
- Full activity row list for the selected period
- Total spent time
- Known estimated hours where available
- Remaining estimate state and explanation
- Warnings for missing estimates, failed issue lookups, or suspicious data

The detail view may be a modal, side panel, or full-width in-page panel, but it
must preserve the user's selected period and return cleanly to the board.

## Status Labels

| Status | Visual intent | Required wording behavior |
|--------|---------------|---------------------------|
| `active` | Strong positive/working state | Must imply Redmine-derived recent activity, not live presence |
| `recently-active` | Neutral recent state | Must show last activity time |
| `inactive-period` | Quiet inactive state | Must state no activity in selected period |
| `no-data` | Data/config problem state | Must tell the user data could not be loaded |
| `needs-attention` | Warning state | Must show why the data looks unusual |

## Refresh Flow

1. User opens dashboard.
2. Dashboard computes the default Today period.
3. Dashboard enters `loading`.
4. Dashboard fetches selected members' Redmine time entries through the proxy for
   the selected period.
5. Dashboard fetches issue details for grouped issue rows when estimates are
   needed.
6. Dashboard renders one period summary per selected member.
7. Dashboard records `lastSuccessfulAt` only after successful summary creation.

On manual refresh or period change:

- Existing data may remain visible while loading if clearly marked as refreshing.
- Failed refresh must not update `lastSuccessfulAt`.
- Failed refresh must show an error message and keep prior successful data marked
  as stale.
- Open detail view must close or update to the new period.

## Empty And Error States

| Scenario | Required display |
|----------|------------------|
| No selected members configured | Empty state asking user to configure team members |
| No entries for all members in period | Member cards with `inactive-period`, plus global empty note |
| Proxy not running | Failed refresh state mentioning local proxy connection |
| Redmine auth failure | Failed refresh state mentioning proxy/Redmine authentication |
| Partial member failure | Show affected member as `no-data` and keep other members visible |
| Missing issue estimates | Show remaining estimate as partial/unknown, not zero |
| Invalid custom range | Show validation error and prevent refresh |

## Accessibility And Responsiveness

- Text must remain readable on mobile and desktop widths.
- Status must not rely on color alone.
- Dropdowns, date inputs, buttons, cards, and detail controls must have clear
  labels.
- Cards/rows must keep stable dimensions so refreshes do not cause confusing
  layout jumps.

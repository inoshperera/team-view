# Research: Team Activity Overview

## Decision: Use Redmine Time Entries As The Primary Activity Signal

**Rationale**: The existing reference dashboard already uses Redmine time entries
successfully through `/time_entries.json?user_id={id}&spent_on={date}`. Time
entries directly provide member, date, project, issue, activity, comments, and
hours, which are enough to satisfy the MVP's latest activity, daily logged time,
and occupied-duration estimate requirements.

**Alternatives considered**:
- Assigned issues only: useful for planned work, but does not prove the person is
  currently or recently active.
- Issue journals or status updates: may reveal recent activity, but introduces a
  broader endpoint set and more interpretation risk for the MVP.
- Live presence tracking: out of scope because Redmine data is not a real-time
  presence source.

## Decision: Treat "Current" As Latest Meaningful Activity Today

**Rationale**: Redmine time entries are usually retrospective or batch-entered,
so the UI must not imply guaranteed real-time presence. The dashboard will label
activity as Redmine-derived and classify it into human-readable states based on
recency and data completeness.

**Alternatives considered**:
- Showing the latest time entry as definitively current: rejected because it
  overstates the reliability of time-log data.
- Requiring users to manually set live status: useful later, but not part of the
  Redmine-first MVP.

## Decision: Estimate Occupied Duration From Latest Entry Hours And Recency

**Rationale**: Redmine entries include logged hours but do not always include a
precise start/end time. The MVP can show a conservative estimate such as
"estimated occupied for 2h" or "recently active" when a recent entry exists. The
UI must visibly distinguish estimates from facts.

**Alternatives considered**:
- Calculating exact end times: rejected because Redmine time entries do not
  reliably supply start timestamps.
- Hiding occupied duration entirely: rejected because the MVP specifically needs
  an initial indication of how long someone may be occupied.

## Decision: Keep Redmine Credentials Server-Side Per Session

**Rationale**: The browser signs in with Redmine username/password through the
local backend. The backend validates those credentials with Redmine Basic Auth,
stores only the returned Redmine API key in a server-side session, and forwards
allowed Redmine requests with that session key. Browser code calls only the
local backend and never sees Redmine passwords or API keys.

**Alternatives considered**:
- Put API key in browser config: rejected by constitution and security
  requirements.
- A shared proxy API key: rejected because multiple users need Redmine calls to
  run with their own credentials.

## Decision: Use A Flat Static App Structure

**Rationale**: The constitution requires the smallest useful client-side stack.
Root-level `index.html`, `styles.css`, `app.js`, and config files are enough for
the MVP and easy for a first Spec Kit project to inspect.

**Alternatives considered**:
- Frontend framework: rejected because the MVP has limited state and no build
  needs.
- Chart/table libraries: deferred because the primary UI is a glanceable board,
  not a reporting dashboard.

## Decision: Manual Refresh First, Optional Auto-Refresh Later

**Rationale**: Manual refresh satisfies the spec and keeps data freshness
explicit. Auto-refresh can be added once Redmine request volume and team needs
are understood.

**Alternatives considered**:
- Poll every few seconds: rejected because it can overload the proxy/Redmine and
  creates a false real-time feel.
- No refresh control: rejected because the dashboard needs visible freshness.

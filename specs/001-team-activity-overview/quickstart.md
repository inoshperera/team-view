# Quickstart: Team Activity Overview

## Prerequisites

- Python 3.10 or newer
- A modern desktop browser
- Redmine username/password access for each signed-in user
- MySQL with a local `team_view` database

## Planned Local Files

```text
index.html          # Dashboard shell
styles.css          # Modern static UI styling
app.js              # Fetch, normalize, summarize, and render activity data
config.example.js   # Safe sample selected-team/proxy config
config.local.js     # Local selected-team/proxy config, ignored by git
redmine_proxy.py    # Team View backend and Redmine passthrough
proxy.py            # Compatibility wrapper
backend/            # DB, Redmine, and service modules
db/schema.mysql.sql # MySQL schema and seed data
requirements.txt    # Backend dependency list
```

## Configure Database And Backend

Create and initialize the database:

```bash
mysql -u root -proot -e "CREATE DATABASE IF NOT EXISTS team_view"
mysql -u root -proot team_view -e "source db/schema.mysql.sql"
```

Install dependencies:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Optional backend environment variables:

```bash
export REDMINE_URL="https://your-redmine.example.com"
export TEAM_VIEW_DB_HOST="localhost"
export TEAM_VIEW_DB_PORT="3306"
export TEAM_VIEW_DB_USER="root"
export TEAM_VIEW_DB_PASSWORD="root"
export TEAM_VIEW_DB_NAME="team_view"
```

Do not put Redmine passwords or API keys in `index.html`, `app.js`, or
browser-loaded config.

## Configure Browser Defaults

Copy the example config if local browser defaults need changing:

```bash
cp config.example.js config.local.js
```

Team membership and planner tasks are stored in MySQL, not in the browser config.

## Run The App

Start both the backend and static dashboard:

```bash
scripts/servers.sh start
```

Expected local proxy URL:

```text
http://localhost:9000
```

If port `9000` or `8000` is already in use, run with another port:

```bash
APP_PORT=8010 PROXY_PORT=9100 scripts/servers.sh start
```

Then set `proxyUrl: "http://localhost:9100"` in `config.local.js`.

## Open The Dashboard

For simplest local browser behavior, use the server control script from the repo
root:

```bash
scripts/servers.sh status
```

Then open:

```text
http://localhost:8000
```

If port `8000` is occupied, use another port such as `8010`.

To shut down both servers:

```bash
scripts/servers.sh stop
```

## MVP Verification

1. Start the backend and static app.
2. Open the dashboard.
3. Sign in with a Redmine account.
4. Confirm High-Level Planner loads teams, projects, users, and tasks from the DB.
5. Create or edit a high-level task.
6. Link a task by selecting a recent Redmine ticket, typing an issue number, or
   pasting a Redmine issue URL.
7. Confirm linked tasks show synced status, progress, dates, and assignees.
8. Confirm `POST /api/sync/redmine` syncs only linked high-level tasks.
9. Switch to Time Logs and confirm Last Week, Last Month, This Month, and Custom Range update the member
   cards for the selected period.
10. Confirm each card shows total spent time, remaining estimate state, and up to
   five grouped activity rows.
11. Confirm members without entries show an inactive/no-activity-for-period state.
12. Click a member card and confirm the detail view shows the selected period,
   full activity list, totals, and estimate details.
13. Click refresh and confirm the last-updated time changes only after success.
14. Stop the backend and refresh again; confirm a visible error state appears and
   previous data is not presented as freshly updated.
15. Search browser-readable files for Redmine passwords/API keys and confirm they are absent.

## Work Overview Verification

1. Use the View selector to switch from Time Logs to Work Overview.
2. Confirm Work Overview is the default view on load.
3. Confirm Settings opens the team configuration view and saves teams through
   the DB-backed `/team-config.json` compatibility route.
4. Confirm Team and Users selection modes render the selected users. Full Team
   is intentionally not shown.
4. Confirm Work Overview loads `/issues.json?assigned_to_id=...&status_id=*`
   through the proxy.
5. Confirm New, Closed, On hold, Staged, and Testing Rejected issues are
   excluded from working-ticket totals and per-user ticket lists.
6. Confirm compact mode is default and shows natural-language copy from
   `data/work-overview-phrases.json`, issue title, priority, dates, due-date
   signal, and logged-vs-estimated time.
7. Tick "Show detailed ticket" and confirm tracker, status, project, and richer
   ticket metadata appear.
8. Confirm issue links open the configured Redmine base URL, not localhost.

## Implementation Verification Results

- Python syntax check passed with `python3 -m py_compile proxy.py`.
- JavaScript syntax check passed with `node --check app.js`.
- Static HTTP smoke check passed on `http://localhost:8010` because port `8000`
  was already occupied in the local environment.
- Proxy smoke check passed on `http://localhost:9100` because port `9000` was
  already occupied in the local environment.
- Allowed proxy path without Redmine env returned a clear missing-configuration
  JSON error.
- Blocked proxy path `/projects.json` returned `403`.
- Chrome headless screenshots were captured for desktop and mobile:
  `browser-smoke.png` and `browser-smoke-mobile.png`.
- Mobile layout metrics showed no horizontal document overflow at `390px` width.
- Browser-readable source search found only placeholder/configuration variable
  names and no real Redmine API key.
- The new implementation uses `referance/` only for endpoint/proxy guidance; the
  old reporting dashboard was not copied wholesale.

## Period Expansion Verification Results

- JavaScript syntax check passed with `node --check app.js`.
- Python syntax check passed with `python3 -m py_compile proxy.py`.
- Live proxy check passed for `/time_entries.json?user_id=20&from=2026-05-12&to=2026-05-12`.
- Live proxy check passed for `/issues/16257.json`.
- Browser smoke check passed for This Week period selection and member detail view.
- Browser smoke check passed for Custom Range on mobile at `390px` width with no horizontal overflow.
- Expansion screenshots were captured:
  `browser-expansion-detail.png` and `browser-expansion-mobile.png`.

## Work Overview Addendum Verification Results

- JavaScript syntax check passed with `node --check app.js`.
- Python syntax check passed with `python3 -m py_compile proxy.py`.
- Browser smoke check passed for Time Logs period options: Last Week, Last Month, This Month, and Custom Range.
- Browser smoke check passed for switching to Work Overview and hiding Time Logs period controls.
- Browser smoke check passed for Settings team JSON generation.
- Proxy smoke check passed for `/issues.json?assigned_to_id=20&status_id=*` with HTTP 200.
- Proxy blocked-path check passed for `/projects.json` with HTTP 403.
- Browser-readable credential search found only placeholder variable names in docs.
- Work Overview screenshots were captured: `browser-time-logs-periods.png`, `browser-work-overview-switched.png`, and `browser-work-settings.png`.

## Post-T077 Work Overview Verification Results

- JavaScript syntax check passed with `node --check app.js`.
- Compact phrase JSON was generated at `data/work-overview-phrases.json` from
  the reviewed Excel matrix.
- The phrase JSON contains no `Staged` phrase group, while `Staged` remains in
  the excluded status list.
- Browser check passed for default compact cards with natural-language phrases.
- Browser check passed for the default-off "Show detailed ticket" toggle.
- Browser check passed for Users mode showing no full user list until searching,
  while keeping selected users visible.
- Browser console error check returned no errors after the compact/detailed
  ticket changes.

## Notes For Future Enhancements

- Auto-refresh can be added after Redmine request volume is understood.
- Issue detail fetching can enrich cards with subjects and statuses.
- Historical productivity factors remain outside the MVP until the activity
  overview is validated.

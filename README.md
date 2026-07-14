# Team Activity Overview

Local Redmine activity board and high-level team planner. The browser app is
still static HTML/CSS/JS, but the Python backend now owns login, per-user
Redmine sessions, organization-directory team cache, and high-level planning
tasks.

## Files

```text
index.html          Dashboard shell
styles.css          Responsive activity-board UI
app.js              Fetch, normalize, summarize, refresh, and render logic
config.example.js   Safe browser-visible sample config
config.local.js     Optional local browser config, ignored by git
redmine_proxy.py    Team View backend and Redmine passthrough
proxy.py            Compatibility wrapper for redmine_proxy.py
backend/            DB, Redmine, and service modules
db/schema.mysql.sql MySQL schema and seed data
imports/high-level-task-import/ Excel workbook and bulk task importer
requirements.txt    Backend dependency list
```

## Deployment Structure

- Static app: `http://localhost:8000`
- Team View backend: `http://localhost:9000`
- MySQL database: `team_view`
- Redmine: authenticated per signed-in user

The browser signs in with Redmine username/password through
`POST /api/auth/login`. The backend verifies those credentials with Redmine
Basic Auth, stores only the returned Redmine API key in a server-side session,
and sends the browser an HTTP-only `session_id` cookie. Existing Redmine calls
for Time Logs and Work Overview are still proxied, but they now use the current
user's session API key instead of a hardcoded key.

The DB stores users, read-only synced teams/team membership, projects,
high-level tasks, linked Redmine ticket cache rows, and sessions. Teams and
members are refreshed from Redmine's organization team payload API at login.

## Configure Backend

Create and initialize the local database:

```bash
mysql -u root -proot -e "CREATE DATABASE IF NOT EXISTS team_view"
mysql -u root -proot team_view -e "source db/schema.mysql.sql"
```

Install backend dependencies:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Optional environment variables:

```bash
export REDMINE_URL="https://your-redmine.example.com"
export TEAM_VIEW_DB_HOST="localhost"
export TEAM_VIEW_DB_PORT="3306"
export TEAM_VIEW_DB_USER="root"
export TEAM_VIEW_DB_PASSWORD="root"
export TEAM_VIEW_DB_NAME="team_view"
export TEAM_DIRECTORY_PAYLOAD_PATH="/admin/ta_teams/payload.json"
export TEAM_DIRECTORY_API_KEY="" # optional service key; otherwise the signed-in user's Redmine API key is used
export TEAM_DIRECTORY_MANAGERS_FILE="data/app-managers.json"
export TEAM_VIEW_LOG_LEVEL="INFO" # use DEBUG temporarily while diagnosing issues
```

Do not put Redmine passwords or API keys in browser-readable source files.

App managers are not inferred from Redmine admin. Put manager emails, usernames,
or directory member IDs in `data/app-managers.json`. Team leads are inferred from
the directory payload's `leadMemberIds`.

If port `9000` or `8000` is already in use:

```bash
APP_PORT=8010 PROXY_PORT=9100 scripts/servers.sh start
```

Then set `proxyUrl: "http://localhost:9100"` in `config.local.js` if needed.

## Configure Browser Defaults

Create a local config from the example:

```bash
cp config.example.js config.local.js
```

Edit `config.local.js`:

```js
window.TEAM_ACTIVITY_CONFIG = {
    proxyUrl: "http://localhost:9000",
    activeWindowMinutes: 90,
    recentWindowMinutes: 240,
    longEntryHours: 8,
    requestTimeoutMs: 12000,
    team: [
        { id: 14, name: "Arshana" }
    ],
    teams: [
        { id: "core-team", name: "Core Team", memberIds: [14] }
    ]
};
```

## Run The Dashboard

Start both the static app and Redmine proxy:

```bash
scripts/servers.sh start
```

Open:

```text
http://localhost:8000
```

Useful server commands:

```bash
scripts/servers.sh status
scripts/servers.sh logs
scripts/servers.sh stop
scripts/servers.sh restart
```

Backend logs are written to stdout/stderr. With `scripts/servers.sh`, they are
captured in `.server/proxy.log`; with `systemd`, send them to journald or your
central log collector. Each backend request emits `request_start` and
`request_end` records with a request id, path, status, client IP, and duration.
State-changing actions also emit `team_view.audit` records for login/logout,
task creates/updates/deletes, Redmine linking, and sync operations. Redmine
upstream requests are logged without passwords, session ids, or API keys.

## Use The Dashboard

Sign in with a Redmine account, then use the View dropdown to switch between
High-Level Planner, Work Overview, and Time Logs.

In High-Level Planner, managers/admins can see across teams and create
high-level tasks. Team leads see their team scope. Tasks can be linked to a
Redmine ticket by selecting a recent ticket, typing an issue number, or pasting
a Redmine issue URL. When a task is linked, status, priority, progress, dates,
and assignees are synced from that ticket and its sub-tickets.

## Bulk Import High-Level Tasks

The Excel import workflow lives in:

```text
imports/high-level-task-import/
├── README.md
├── high-level-task-import.xlsx
└── import_tasks.py
```

The script reads the local `.xlsx` file in that folder. If the team updates the
Google Sheets version, download/export it back over
`imports/high-level-task-import/high-level-task-import.xlsx` before importing.

Validate rows against an environment without creating tasks:

```bash
python3 imports/high-level-task-import/import_tasks.py --env local --username YOUR_USERNAME --check
python3 imports/high-level-task-import/import_tasks.py --env production --username YOUR_USERNAME --check
```

Import rows:

```bash
python3 imports/high-level-task-import/import_tasks.py --env local --username YOUR_USERNAME
python3 imports/high-level-task-import/import_tasks.py --env production --username YOUR_USERNAME
```

Notes:

- The default behavior creates tasks immediately; there is no dry-run/apply
  split.
- `--env prod` is accepted as a short production alias.
- `Task ID` is workbook-local. `Depends On Task ID` is converted to
  `parentTaskId`.
- Duplicate protection skips existing tasks with the same title, team, and start
  date unless `--allow-duplicates` is supplied.
- If `Redmine Ticket` is filled, the task is linked after creation. Redmine
  linking can overwrite status, priority, progress, dates, and assignees.
- Team and member values must exist in the target environment's `/api/bootstrap`
  response. Local and production directories may differ.

In Time Logs, use the period selector to switch between:

- Last week
- Last month
- This month
- Custom range

The dashboard reloads Redmine time entries for the selected period. Each member
card shows total spent time for that period, remaining estimate state, and up to
five grouped activity/ticket rows. Click a member card to open the detail view
with the full activity list and estimate details for that same period.

Remaining time is calculated from Redmine issue estimated hours when available.
If Redmine has no estimate for one or more issues, the dashboard marks the value
as partial or unknown instead of guessing.

In Work Overview, select Full team, a configured team, or searched users. The
view loads active Redmine users through the proxy, loads assigned Redmine issues,
excludes New and Closed tickets from active work, and shows total working
tickets, active people, and each selected person's working ticket list with
tracker, status, priority, start date, and due date.

The Settings view is now a read-only team directory. It shows the teams,
members, and leads synced from the organization payload. Managers can trigger a
manual directory refresh; team edits should be made in the organization system.

## Verification

- `.venv/bin/python -m py_compile proxy.py redmine_proxy.py backend/*.py`
- `node --check app.js`
- Start the backend and static app with `scripts/servers.sh start`.
- Sign in through `/api/auth/login`.
- Check `/api/bootstrap` returns teams, users, projects, and lookup data.
- Check `/api/tasks` returns high-level tasks.
- Check `/api/redmine/recent-tickets?q=12515` accepts ticket numbers.
- Check `POST /api/tasks/{id}/link` links a high-level task to a Redmine issue.
- Check `POST /api/sync/redmine` syncs only linked high-level tasks.
- Check an allowed Redmine passthrough path such as `/time_entries.json`.
- Check a period query such as `/time_entries.json?user_id=20&from=2026-05-12&to=2026-05-12`.
- Check an issue lookup such as `/issues/16257.json` when estimating remaining time.
- Check an issue list such as `/issues.json?assigned_to_id=20&status_id=*` for Work Overview.
- Check `POST /team-config.json` and `GET /team-config.json` through the backend for DB-backed team settings.
- Check a blocked path such as `/projects.json` returns `403`.
- Open the dashboard and confirm every configured member appears.
- Switch period presets and apply a custom range.
- Switch to Work Overview and confirm Full team, Team, and Users selections render.
- Confirm each card shows up to five activity rows and opens a detail view.
- Confirm no real Redmine password or API key appears in browser-readable source files.

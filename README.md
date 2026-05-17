# Team Activity Overview

Local Redmine activity board for seeing what selected team members are currently
or recently working on. The MVP is intentionally small: static HTML/CSS/JS in
the browser plus a local Python proxy for credentialed Redmine API calls.

## Files

```text
index.html          Dashboard shell
styles.css          Responsive activity-board UI
app.js              Fetch, normalize, summarize, refresh, and render logic
config.example.js   Safe browser-visible sample config
config.local.js     Optional local browser config, ignored by git
proxy.py            Local Redmine proxy
requirements.txt    Proxy dependency note
```

## Configure Redmine Proxy

Set credentials in your shell before starting the proxy:

```bash
export REDMINE_URL="https://your-redmine.example.com"
export REDMINE_API_KEY="your-local-api-key"
scripts/servers.sh start
```

The browser app only talks to `http://localhost:9000` by default. Do not put the
API key in `index.html`, `app.js`, `config.example.js`, or `config.local.js`.

If port `9000` or `8000` is already in use:

```bash
APP_PORT=8010 PROXY_PORT=9100 scripts/servers.sh start
```

Then set `proxyUrl: "http://localhost:9100"` in `config.local.js`.

## Configure Team Members

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

## Use The Dashboard

Use the View dropdown to switch between Time Logs and Work Overview.

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

Use Settings in Work Overview to create local teams and assign users. Click
`Save teams` to write the team JSON to `team-config.local.json` through the
local proxy. That file is ignored by git and loaded again on the next refresh or
browser reload.

## Verification

- `python3 -m py_compile proxy.py`
- `node --check app.js`
- Start the proxy and check an allowed path such as `/time_entries.json`.
- Check a period query such as `/time_entries.json?user_id=20&from=2026-05-12&to=2026-05-12`.
- Check an issue lookup such as `/issues/16257.json` when estimating remaining time.
- Check an issue list such as `/issues.json?assigned_to_id=20&status_id=*` for Work Overview.
- Check `POST /team-config.json` and `GET /team-config.json` through the proxy for local team settings.
- Check a blocked path such as `/projects.json` returns `403`.
- Open the dashboard and confirm every configured member appears.
- Switch period presets and apply a custom range.
- Switch to Work Overview and confirm Full team, Team, and Users selections render.
- Confirm each card shows up to five activity rows and opens a detail view.
- Confirm no real Redmine API key appears in browser-readable source files.

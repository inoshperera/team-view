# Quickstart: Team Activity Overview

## Prerequisites

- Python 3.10 or newer
- A modern desktop browser
- Redmine API access for the team data
- Local Redmine API key stored outside browser-readable files

## Planned Local Files

```text
index.html          # Dashboard shell
styles.css          # Modern static UI styling
app.js              # Fetch, normalize, summarize, and render activity data
config.example.js   # Safe sample selected-team/proxy config
config.local.js     # Local selected-team/proxy config, ignored by git
proxy.py            # Local Redmine API proxy
requirements.txt    # Proxy dependency list if requests is used
```

## Configure Proxy Credentials

Set local environment variables before starting the proxy:

```bash
export REDMINE_URL="https://your-redmine.example.com"
export REDMINE_API_KEY="your-local-api-key"
```

Do not put the API key in `index.html`, `app.js`, or browser-loaded config.

## Configure Selected Team

Copy the example config when implementation creates it:

```bash
cp config.example.js config.local.js
```

Edit `config.local.js` with selected Redmine user IDs and display names.

## Run The Proxy

The MVP proxy uses Python standard-library HTTP modules, so no third-party
packages are required. `requirements.txt` is kept as a dependency note.

Install proxy dependencies only if future changes add any:

```bash
python3 -m pip install -r requirements.txt
```

Start both the proxy and static dashboard:

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

1. Start the proxy with valid Redmine credentials.
2. Open the dashboard.
3. Confirm every configured team member appears.
4. Confirm Last Week, Last Month, This Month, and Custom Range update the member
   cards for the selected period.
5. Confirm each card shows total spent time, remaining estimate state, and up to
   five grouped activity rows.
6. Confirm members without entries show an inactive/no-activity-for-period state.
7. Click a member card and confirm the detail view shows the selected period,
   full activity list, totals, and estimate details.
8. Click refresh and confirm the last-updated time changes only after success.
9. Stop the proxy and refresh again; confirm a visible error state appears and
   previous data is not presented as freshly updated.
10. Search browser-readable files for the API key and confirm it is absent.

## Work Overview Verification

1. Use the View selector to switch from Time Logs to Work Overview.
2. Confirm Work Overview is the default view on load.
3. Confirm Settings opens the team configuration view and saves team JSON through
   the local proxy to `team-config.local.json`.
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

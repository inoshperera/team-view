# High-level Tasks View — Handoff Package

Adds a high-level task-planning layer (sign-in, team-lead board, manager
multi-team board, Redmine sync, drill-down) on top of the existing Team
Activity Overview app.

## What's in this folder

```
handoff/
├── README.md                        ← you are here
├── INTEGRATION_GUIDE.md             ← full KT script: features, design, APIs, DAO, auth
├── ui/                              ← drop-in HTML/CSS/JSX (vanilla, no build step)
│   ├── index.html
│   ├── styles.css
│   ├── app.jsx
│   ├── components.jsx
│   ├── login.jsx
│   ├── task-editor.jsx
│   ├── drilldown.jsx
│   ├── team-lead-dashboard.jsx
│   ├── manager-dashboard.jsx
│   └── data.js                      ← DEMO-ONLY mock data (remove on integration)
└── db/
    ├── schema.sql                   ← PostgreSQL 14+
    └── schema.mysql.sql             ← MySQL 8+
```

## Run the prototype as-is

It's plain HTML + JSX-via-Babel — no bundler. Serve `ui/` from any static
server:

```bash
cd handoff/ui
python -m http.server 8080
# open http://localhost:8080/index.html
```

Demo logins (all bypassed once LDAP auth is wired):

| Role | Username | Password |
|------|----------|----------|
| Team Lead | `uem.lead` / `iot.lead` / `rems.lead` / `plat.lead` | `lead` |
| Manager | `manager` | `manager` |

## Merging into the existing project

Read **INTEGRATION_GUIDE.md** end-to-end first. The short version:

1. Drop the files in `ui/` next to your existing `index.html` (or under a
   new `/planner/` route).
2. Apply `db/schema.sql` (or `schema.mysql.sql`).
3. Import existing `team-config.local.json` members into `users` +
   `team_members` (one-time migration; query at the bottom of each schema
   file).
4. Add the new HTTP routes to `proxy.py` — see § "Backend API contract"
   in the guide.
5. Wire `/api/auth/login` to OpenLDAP. **Do not store passwords in the
   DB.**
6. Delete `ui/data.js` and replace every reference with a `fetch()` call —
   the file's banner lists each mapping.
7. Start the Redmine-sync worker (cron / background thread inside the
   proxy works fine at this scale).

The guide also covers DAO responsibilities, session handling, CSRF, and
the sync algorithm.

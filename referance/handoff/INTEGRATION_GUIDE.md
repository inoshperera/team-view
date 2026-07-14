# High-level Tasks View — Integration Guide

A complete handoff document for the new high-level task-planning layer
that sits on top of your existing Team Activity Overview app.

Read top-to-bottom on first pass; come back as a reference per section
during integration.

---

## Table of contents

1. [What this UI does](#1-what-this-ui-does)
2. [Design system & visual language](#2-design-system--visual-language)
3. [Screen-by-screen walkthrough](#3-screen-by-screen-walkthrough)
4. [Architecture & file map](#4-architecture--file-map)
5. [Demo data — what to remove and where](#5-demo-data--what-to-remove-and-where)
6. [Database schema](#6-database-schema)
7. [Backend API contract](#7-backend-api-contract)
8. [DAO layer](#8-dao-layer)
9. [Authentication & sessions (OpenLDAP)](#9-authentication--sessions-openldap)
10. [Redmine sync worker](#10-redmine-sync-worker)
11. [Migrating `team-config.local.json` into the DB](#11-migrating-team-configlocaljson-into-the-db)
12. [Hooking it into the existing `proxy.py`](#12-hooking-it-into-the-existing-proxypy)
13. [Operational concerns](#13-operational-concerns)
14. [Checklist for the merging agent](#14-checklist-for-the-merging-agent)

---

## 1. What this UI does

The existing **Team Activity Overview** (the screenshot you already
have) shows per-member work-ticket activity pulled from Redmine. It
answers the question *"what is each engineer working on right now?"*

This new view adds a **planning layer above it**, answering *"what
high-level work is each team driving — and how is it prioritised?"*.
Examples of high-level work it can hold:

- HR work (hiring, reviews, performance cycles)
- Operational work (renewals, migrations, infra rotations)
- Development work (sprints, release burn-downs)
- Customer work (escalations, training, rollouts)

Each high-level task can be *linked* to a Redmine ticket — in which
case its status, progress, dates, and assignees are continuously
**synced from Redmine** (including any sub-tickets). When unlinked, the
team-lead manages those fields manually in this system.

Two user roles:

- **Team Lead** — sees & edits their own team's high-level tasks.
- **Manager** — sees high-level tasks across all teams, filterable by
  team and member.

Both can drill down into the existing per-member Work Overview screen
for any team.

---

## 2. Design system & visual language

The view deliberately re-uses your existing tokens so it looks native:

| Token | Value | Source |
|-------|-------|--------|
| Page background | `#eef1f5` | existing `:root --page-bg` |
| Surface | `#ffffff` | existing |
| Border | `#d9e0ea` | existing |
| Accent | `#2563eb` | existing |
| Active / OK | `#16845b` on `#e8f7f0` | existing status colours |
| Recent / warn | `#7a5d00` on `#fff6d8` | existing |
| Attention / overdue | `#b42318` on `#fff1f0` | existing |
| Priority tints | `#fff0f0 / #fff0e8 / #fff8e6 / #eef8f3 / #f5f7fa` | existing work-ticket tints |
| Radius | 8px | existing |
| Font | Inter | existing |

The **only** new colour family is the **category accents** (Dev / HR /
Operations / Customer). They use the same chroma/lightness band so they
sit alongside the existing palette without clashing:

```
Development → blue   (#1d4ed8 on #e8efff)
HR          → purple (#6d5bd0 on #f0edff)
Operations  → teal   (#0e7490 on #e0f6fb)
Customer    → amber  (#b45309 on #fffaf0)
```

### Component anatomy of a task card (lanes view)

```
┌────────────────────────────────────────────────────────┐
│ [CATEGORY] [TEAM]  [🔗 synced]            [Status pill]│   ← chip-row + head-meta
│                                                        │
│ Customer escalation – ACME UEM agent rollout           │   ← title
│ Joint debugging session…                               │   ← description (2-line clamp)
│                                                        │
│ ┌──────────┬──────────┐                                │
│ │ Project  │ Priority │   ← 2×2 meta-grid (4 cells)   │
│ ├──────────┼──────────┤                                │
│ │ Due      │ Linked   │                                │
│ └──────────┴──────────┘                                │
│ ─────────────────────────────                          │
│ MEMBERS (2)                                            │   ← member-strip
│  ⓐ Arshana Atapattu   ⓢ Sahan Wickrama                │
└────────────────────────────────────────────────────────┘
```

In list view the card stretches to full width and the meta-grid expands
to 5 cells (Project / Priority / Due / Linked issue / Progress).

### Why these choices

- **Priority lanes** (Critical / High / Medium / Low — 4 cols) are the
  default because *priority* is the most actionable filter for a lead
  with limited bandwidth, more than category.
- **Category lanes** are a single toggle away because a manager often
  asks "how much HR/Ops work are we doing across the org?".
- **Synced fields panel** (light blue) makes it impossible to forget
  which fields are owned by Redmine — they literally turn into a
  read-only panel with a "Synced from Redmine" badge next to each
  value. Status/progress/dates **and** assignees are all locked when
  linked, because assignees are derived from the parent ticket + its
  sub-tickets.
- **Member strip** at the bottom of every card spells out first + last
  name (not just avatars), so a lead can scan a column without
  hovering.

---

## 3. Screen-by-screen walkthrough

### 3.1 Sign-in (`login.jsx`)

- Segmented control to pick **Team Lead** vs **Manager** mode. After
  LDAP integration this segment can be removed — role comes from the
  user record returned by `/api/auth/me`.
- Demo credentials are listed in a hint card and **must be removed**
  before going live.
- Submits to `/api/auth/login` (TODO — currently runs `onLogin` locally
  with the matched team).

### 3.2 Team Lead dashboard (`team-lead-dashboard.jsx`)

- Top bar: title, user chip with name + role, drill-down button, sign
  out, **Add task**.
- Filter strip: Member, Category, Status, Search.
- Layout toggles: *By Priority* / *By Category* and *Lanes* / *List*.
- Summary tiles: Open / Critical / Due this week / Overdue.
- Body: priority or category lanes; cards described above.

### 3.3 Manager dashboard (`manager-dashboard.jsx`)

- Same lane layout as the lead view (4 columns).
- Adds a **Team** filter. When a single team is picked, the top bar
  shows a "Drill-down · {team}" button.
- Each card carries a small **team chip** (UEM / IoT / REMS / …) so
  cross-team context is obvious.
- Summary tiles aggregate across the filtered scope.

### 3.4 Task editor modal (`task-editor.jsx`)

The whole CRUD surface for a task. Key states:

- **Unlinked task** — Status, Progress, Start, Due, Members are
  editable. Members come from the lead's team.
- **Linked to Redmine** — Picking a ticket from the project's Redmine
  dropdown flips the modal into "synced" mode:
  - The four time/progress fields become a read-only blue panel.
  - Assigned members become a locked, read-only list.
  - An **Unlink** button restores manual mode.
  - Changing the project drops the link automatically (the old ticket
    belongs to the old project).

Member assignment is a checkbox list scoped to the lead's team. For
managers the team is whichever team the task already belongs to (or
the first team for new tasks; this can be improved with a team
selector if managers need to create tasks in any team).

### 3.5 Drill-down (`drilldown.jsx`)

Re-creates the existing per-member Work Overview board for the
selected team. In production this should **not** render mock tickets
— wire it to your existing `/api/work-overview?team_id=…` (or
whatever route `app.js` already calls) and pass the JSON straight
through.

---

## 4. Architecture & file map

```
ui/
├── index.html               ← shell; loads React, Babel, and every JSX module in order
├── styles.css               ← all styles; uses existing CSS vars + adds new ones
├── data.js                  ← !!! DEMO ONLY !!! mock teams/people/tasks/redmine
├── components.jsx           ← shared atoms: Icon, CategoryChip, StatusPill, AvatarStack, Modal, date helpers
├── login.jsx                ← LoginScreen
├── task-editor.jsx          ← TaskCard + TaskEditor modal
├── drilldown.jsx            ← Drilldown screen (mimics the existing Work Overview)
├── team-lead-dashboard.jsx  ← TeamLeadDashboard + Lanes (shared with manager)
├── manager-dashboard.jsx    ← ManagerDashboard
└── app.jsx                  ← App root: auth gate, routing, task store, modal wiring
```

### Why so many files

Each `<script type="text/babel">` is independently transpiled, so
keeping logical components in their own files makes it trivial to
extract one (e.g. `task-editor.jsx`) into a real bundler later. Every
file ends with `Object.assign(window, { …exports })` so the dependency
graph is explicit. The load order in `index.html` matches that graph:

```
data.js  →  components.jsx  →  login.jsx
                          ↘  task-editor.jsx  →  team-lead-dashboard.jsx ┐
                          ↘  drilldown.jsx                                ├→ app.jsx
                                                  manager-dashboard.jsx ─┘
```

### State management

There is no framework — just React 18 with `useState`/`useEffect` in
`app.jsx`. The two pieces of persistent state in the prototype are:

- `localStorage["thlv.user"]` — the logged-in user record
- `localStorage["thlv.tasks"]` — the task array, seeded from
  `SEED_TASKS`

Both **must** be removed when wiring to the backend. The replacement
pattern is:

```js
// app.jsx — replace useStoredState with a server fetch
const [tasks, setTasks] = React.useState([]);
React.useEffect(() => {
  fetch('/api/tasks', { credentials: 'include' })
    .then(r => r.json()).then(setTasks);
}, []);
```

Every CRUD handler (`saveTask`, `deleteTask`, `linkTicket`, etc) then
becomes a `fetch(..., { method: 'POST' })` and re-fetches the list.

---

## 5. Demo data — what to remove and where

`ui/data.js` is **entirely** demo-only. The file's header banner names
every constant and which API replaces it. Concretely:

| Constant in `data.js` | Replace with |
|------------------------|---------------|
| `TEAMS` | `GET /api/teams` |
| `MANAGER` | `GET /api/auth/me` |
| `PEOPLE` | `GET /api/teams/{id}/members` or aggregate of all |
| `PROJECTS` | `GET /api/projects` |
| `CATEGORIES`, `PRIORITIES`, `STATUSES` | `GET /api/{categories,priorities,statuses}` or inline as constants — they're closed sets |
| `REDMINE_TICKETS` | `GET /api/projects/{id}/redmine-tickets` |
| `SEED_TASKS` | `GET /api/tasks?team_id=…` |
| `DRILL_TICKETS` | Existing Work-Overview endpoint (already in your proxy) |

Also delete:

- The fixed `TODAY` date pin in `components.jsx` — switch to
  `new Date()`. It's pinned to the screenshot's day so the demo "due
  this week" stays consistent.
- The demo credentials hint card in `login.jsx`.
- The `useStoredState` helper in `app.jsx` (replace with fetch +
  setState).

---

## 6. Database schema

Two flavours are included:

- `db/schema.sql` — PostgreSQL 14+
- `db/schema.mysql.sql` — MySQL 8+

### Entity overview

```
users ─┬─< team_members >─ teams
       ├─< task_assignments >─ tasks ─< projects
       ├─< redmine_ticket_assignees >─ redmine_tickets ─< projects
       └─< user_sessions
```

### Key invariants

- `users.username` is the **LDAP uid**. **No password is ever stored**
  — the schema deliberately omits a `password_hash` column.
- `team_members` replaces the `memberIds[]` array in your existing
  `team-config.local.json`. Importing the JSON is a one-time job
  (queries at the bottom of each schema file).
- `tasks.redmine_ticket_id` is the single source of truth for
  *"this row is Redmine-synced"*. When non-NULL:
  - the API must refuse client edits to `status_id`, `progress`,
    `start_date`, `due_date`
  - the API must refuse manual edits to `task_assignments` (the sync
    worker owns them)
- `task_assignments.source` distinguishes manual picks from the sync
  worker's writes, so the worker can `DELETE WHERE source='redmine'`
  before re-inserting, without clobbering manual picks made on the
  same task before it was linked.
- `tasks.deleted_at` is the soft-delete column; every read query has
  `WHERE deleted_at IS NULL`.

### Lookup tables vs enums

`categories`, `priorities`, `statuses` are *tables* (not enums) so
ops can add new buckets without redeploying. If you'd rather pin them,
they can be enums in MySQL or `CHECK` constraints in Postgres. Their
keys are short string ids that mirror the UI's class names
(`pri-critical`, `chip-dev`, etc) so renderers can map straight
through.

---

## 7. Backend API contract

REST + JSON. Cookie-based session (see § 9). All endpoints return
`application/json` and accept it. All examples assume the user is
authenticated unless noted.

### 7.1 Auth

| Method | Path | Body / Query | Response |
|--------|------|--------------|----------|
| POST | `/api/auth/login` | `{username, password}` | `{user}` — sets `session_id` cookie |
| POST | `/api/auth/logout` | — | `204` — clears cookie |
| GET  | `/api/auth/me` | — | `{user}` |

`user` shape:

```jsonc
{
  "id": 14,
  "username": "uem.lead",          // LDAP uid
  "displayName": "Arshana Atapattu",
  "email": "arshana@…",
  "role": "lead",                  // member | lead | manager | admin
  "teamId": "uem",                 // only for role=lead; managers see all teams
  "redmineUserId": 14,
  "avatarColor": "av-a"
}
```

### 7.2 Reference / lookup

| GET | `/api/teams` | `[{id, name, lead: {…user}, memberCount}]` |
| GET | `/api/teams/{id}` | one team + `members: [user]` |
| GET | `/api/projects?source=redmine&active=true` | `[{id, name, source, redmineIdentifier}]` |
| GET | `/api/projects/{id}/redmine-tickets` | `[{redmineIssueId, issueKey, title, status, priority, progress, startDate, dueDate, assignees:[userId]}]` |
| GET | `/api/categories` | `[{id, label, colorClass}]` |
| GET | `/api/priorities` | `[{id, label, sortOrder, colorClass}]` |
| GET | `/api/statuses` | `[{id, label, isTerminal, colorClass}]` |

### 7.3 High-level tasks (CRUD)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/tasks?team_id=&member_id=&category=&priority=&status=&q=&include=members,project,redmineTicket` | list with filters |
| GET | `/api/tasks/{id}` | one task with related data |
| POST | `/api/tasks` | create — body: full task shape (see below) |
| PATCH | `/api/tasks/{id}` | partial update — **rejects synced fields when `redmineTicketId` is set** with `409` |
| DELETE | `/api/tasks/{id}` | soft-delete |
| POST | `/api/tasks/{id}/link` | body: `{redmineIssueId}` — triggers immediate sync |
| POST | `/api/tasks/{id}/unlink` | clears the link |

Task POST body (manual case):

```jsonc
{
  "teamId": "uem",
  "projectId": 5,
  "categoryId": "dev",
  "priorityId": "high",
  "statusId": "working",
  "title": "Sprint 23 — burn-down",
  "description": "Coordinate fixes…",
  "progress": 60,
  "startDate": "2026-05-11",
  "dueDate": "2026-05-22",
  "redmineTicketId": null,
  "memberIds": [14, 11, 104]
}
```

Server rules:

1. **Authorisation:**
   - `lead` can only mutate tasks where `team_id` matches their own team.
   - `manager` and `admin` can mutate any team's tasks.
   - `member` can only read.
2. **Synced field protection:** when `redmineTicketId` is set, PATCH
   must error on any change to `statusId`, `progress`, `startDate`,
   `dueDate`, or `memberIds`. Title/description/category/priority/
   project remain editable.
3. **Audit:** every successful mutation writes a `task_audit_log` row.

### 7.4 Redmine sync trigger

| POST | `/api/sync/redmine` | admin-only; manually re-pull the cache + re-sync linked tasks |

A scheduled job calls this internally — see § 10.

### 7.5 Work-overview drill-down

Reuse whatever endpoint your existing `app.js` already calls. The
drill-down screen in this prototype mocks the payload (`DRILL_TICKETS`
in `data.js`); on integration, replace that with the live JSON.

---

## 8. DAO layer

One DAO per table is plenty for an app this size. Sketch:

```python
# users
class UserDao:
    def find_by_id(self, id) -> User
    def find_by_username(self, ldap_uid) -> User | None
    def find_by_email(self, email) -> User | None
    def find_by_redmine_id(self, rid) -> User | None
    def upsert_from_ldap(self, ldap_attrs) -> User   # provisions on first login
    def list_for_team(self, team_id) -> [User]

# sessions
class SessionDao:
    def create(self, user_id, token_hash, ttl_seconds, ua, ip) -> Session
    def find_by_token_hash(self, token_hash) -> Session | None
    def touch(self, session_id)                       # updates last_used_at
    def delete(self, session_id)
    def purge_expired(self)

# teams
class TeamDao:
    def list(self) -> [Team]
    def get(self, id) -> Team
    def create(self, id, name, lead_user_id=None)
    def update(self, id, **patch)
    def set_lead(self, id, user_id)
    def deactivate(self, id)

class TeamMemberDao:
    def list(self, team_id) -> [User]
    def add(self, team_id, user_id)
    def remove(self, team_id, user_id)

# lookups (read-only at runtime)
class CategoryDao:
    def list(self) -> [Category]
class PriorityDao:
    def list(self) -> [Priority]
class StatusDao:
    def list(self) -> [Status]

# projects
class ProjectDao:
    def list(self, source=None, active=True) -> [Project]
    def get(self, id) -> Project
    def get_by_redmine_id(self, rid) -> Project | None
    def upsert_from_redmine(self, redmine_project_dto) -> Project
    def create_internal(self, name, owner_team_id=None) -> Project

# redmine cache
class RedmineTicketDao:
    def upsert(self, dto) -> RedmineTicket
    def get_by_issue_id(self, redmine_issue_id) -> RedmineTicket | None
    def list_for_project(self, project_id) -> [RedmineTicket]
    def children_of(self, ticket_id) -> [RedmineTicket]

class RedmineTicketAssigneeDao:
    def replace_for_ticket(self, ticket_id, user_ids)
    def assignees_in_subtree(self, root_ticket_id) -> [int]   # parent ∪ all children

# tasks (the workhorse)
class TaskDao:
    def list(self, *, team_id=None, member_id=None, category=None,
             priority=None, status=None, q=None) -> [Task]
    def get(self, id, include=()) -> Task
    def create(self, dto) -> Task
    def update(self, id, dto) -> Task                # *raises* if a synced field changes while linked
    def soft_delete(self, id)
    def link_redmine(self, task_id, ticket_id)
    def unlink_redmine(self, task_id)
    def sync_fields_from_ticket(self, task_id, ticket_dto)  # sync-worker call path

class TaskAssignmentDao:
    def list(self, task_id) -> [(User, source)]
    def replace_manual(self, task_id, user_ids)      # only when not linked
    def replace_redmine(self, task_id, user_ids)     # only writes source='redmine'

class TaskAuditDao:
    def record(self, task_id, user_id, action, diff_dict)
```

Wrap every DAO method in a transaction at the service layer. Use
`SELECT … FOR UPDATE` on the `tasks` row inside the sync worker and
inside `TaskDao.update` to avoid lost-update races between sync and
manual edits.

---

## 9. Authentication & sessions (OpenLDAP)

### 9.1 Flow

```
┌──────────┐    POST /api/auth/login              ┌────────┐
│ Browser  │ ─────────────────────────────────► │ proxy.py│
└──────────┘   {username, password}              └───┬────┘
                                                    │ 1. bind to LDAP
                                                    │    ldap://ldap.entgra.io:389
                                                    │    DN: uid=<u>,ou=People,dc=entgra,dc=io
                                                    │
                                                    │ 2. if bind ok, fetch attrs
                                                    │    (cn, mail, uid, employeeNumber)
                                                    │
                                                    │ 3. UserDao.upsert_from_ldap()
                                                    │      → create local user row if first time
                                                    │      → map redmine_user_id by email/uid
                                                    │
                                                    │ 4. SessionDao.create(user_id,
                                                    │      token_hash=sha256(random_uuid()),
                                                    │      ttl=8h)
                                                    │
                                                    │ 5. Set-Cookie: session_id=<uuid>;
                                                    │      HttpOnly; Secure; SameSite=Strict;
                                                    │      Path=/; Max-Age=28800
                                                    ▼
                                                  200 {user}
```

### 9.2 Server-side session table

`user_sessions` in the schema is exactly this. Keep `token_hash`
(SHA-256 of the cookie value) — never store the raw cookie. The cookie
holds the **UUID**, the DB holds its hash.

### 9.3 Middleware

Every authenticated request:

1. Reads cookie `session_id` (UUID).
2. `SessionDao.find_by_token_hash(sha256(cookie))`.
3. If missing/expired → 401.
4. Else attach `request.user = UserDao.find_by_id(session.user_id)`
   and `SessionDao.touch(session.id)`.

### 9.4 Logout

`POST /api/auth/logout`:

1. `SessionDao.delete(request.session.id)`.
2. `Set-Cookie: session_id=; Max-Age=0`.

### 9.5 CSRF

Because the cookie is `SameSite=Strict`, CSRF is mostly handled.
For belt-and-braces, issue a non-HttpOnly `csrf_token` cookie on login;
require it as `X-CSRF-Token` header on every non-GET. Reject if
mismatch.

### 9.6 Dummy logins for early development

Before LDAP is wired, allow a small in-process map of
`username → user_id` (loaded from a file like `auth.dummy.json`)
**guarded behind an env flag** (`ALLOW_DUMMY_LOGIN=true`). It must be
impossible to enable in production. Example:

```python
def login(request):
    body = request.json
    user = None
    if env('ALLOW_DUMMY_LOGIN') == 'true':
        user = DummyAuth.try_login(body['username'], body['password'])
    if not user:
        user = LdapAuth.try_login(body['username'], body['password'])
    if not user:
        return 401
    return start_session(user)
```

### 9.7 What the schema deliberately omits

- **No `password_hash` column.** Passwords never reach the DB.
- **No security-question / 2FA columns.** Handled at the LDAP layer.

If you ever need a non-LDAP service account (e.g. for the sync
worker), use a long-lived API key in a separate `api_keys` table —
don't reuse `users`.

---

## 10. Redmine sync worker

Goal: keep the `tasks` rows whose `redmine_ticket_id` is non-NULL in
lockstep with their Redmine source-of-truth.

### 10.1 Scope

For every linked task:

1. Refresh the linked `redmine_tickets` row (status, progress, dates,
   priority, etc.) from Redmine's `/issues/{id}.json?include=children`.
2. Refresh each child sub-ticket recursively (one level is usually
   enough — Redmine sub-tasks rarely nest).
3. Recompute the union of assignees across (parent + sub-tickets) and
   write into `task_assignments` with `source='redmine'`.
4. Copy `status / progress / start_date / due_date` onto the task.
5. `last_redmine_sync_at = now()`.

### 10.2 Algorithm sketch

```python
def sync_one(task):
    parent = redmine.get_issue(task.redmine_issue_id, include_children=True)
    RedmineTicketDao.upsert(parent)

    all_assignees = set()
    for ticket in walk(parent):                     # parent + children
        RedmineTicketDao.upsert(ticket)
        RedmineTicketAssigneeDao.replace_for_ticket(
            ticket.id, [a.user_id for a in ticket.assignees])
        all_assignees.update(a.user_id for a in ticket.assignees)

    TaskDao.sync_fields_from_ticket(task.id, parent)
    TaskAssignmentDao.replace_redmine(task.id, list(all_assignees))
    TaskAuditDao.record(task.id, system_user_id, 'synced', diff)
```

### 10.3 Scheduling

Three options, in order of simplicity:

1. **Background thread inside `proxy.py`** running a 60-second loop
   that pulls every task with `redmine_ticket_id IS NOT NULL` whose
   `last_redmine_sync_at` is older than N minutes. Fine for ≤ a few
   hundred linked tasks.
2. **Cron job** that calls `POST /api/sync/redmine` every N minutes.
3. **Real queue** (e.g. RQ + Redis) for scale beyond a few thousand.

Pick (1) for now; the API endpoint at § 7.4 is there for manual
re-syncs and for option (2) later.

### 10.4 Backpressure

Cap Redmine RPS at ~5/s and retry with exponential backoff on 429/5xx.
The cached `redmine_tickets` table means UI loads never hit Redmine.

---

## 11. Migrating `team-config.local.json` into the DB

Your current config:

```json
{
  "teams": [
    { "id": "uem", "name": "UEM", "memberIds": [14, 11, 104, 20] },
    { "id": "gc",  "name": "GC",  "memberIds": [9, 8] }
  ]
}
```

One-time script:

```sql
-- 1. Teams
INSERT INTO teams (id, name) VALUES
  ('uem','UEM'), ('gc','GC');

-- 2. Users (provision shells; LDAP attrs fill in on first login)
INSERT INTO users (redmine_user_id, first_name, last_name) VALUES
  (14, 'Unknown', 'User-14'),
  (11, 'Unknown', 'User-11'),
  -- …
ON CONFLICT (redmine_user_id) DO NOTHING;       -- Postgres
-- ON DUPLICATE KEY UPDATE redmine_user_id=redmine_user_id;   -- MySQL

-- 3. Team membership
INSERT INTO team_members (team_id, user_id)
SELECT 'uem', id FROM users WHERE redmine_user_id IN (14,11,104,20)
UNION ALL
SELECT 'gc',  id FROM users WHERE redmine_user_id IN (9,8);
```

After this:

- `team-config.local.json` becomes obsolete — keep it in the repo as
  a backup for one release, then delete.
- The reads that used to load that JSON now go through `TeamDao` /
  `TeamMemberDao`.
- Redmine's `/users.json` can populate the `users` rows nightly
  (name, email) so you don't have to wait for first-login to fill them
  in.

---

## 12. Hooking it into the existing `proxy.py`

Your `proxy.py` already exposes Redmine-backed endpoints. The
integration is additive:

1. **Add a DB connection pool** (PostgreSQL `psycopg2`/`asyncpg` or
   MySQL `PyMySQL` — both are fine; the schemas are
   shape-compatible).
2. **Add the new routes** from § 7. Group them under `/api/*` and put
   your existing Redmine endpoints behind the same prefix for
   consistency.
3. **Add session middleware** that runs before every `/api/*` route
   except `/api/auth/login`. Sets `request.user`.
4. **Add the sync loop** (option 1 from § 10.3) as a background thread
   started at process boot.
5. **Serve `ui/` as static files.** The HTML is plain, so this is just
   `app.mount('/', StaticFiles(directory='ui'))` (FastAPI) or
   equivalent.

The UI assumes the API is on the **same origin** as the static files,
so no CORS config is needed.

If you want to migrate to a SPA build later, every JSX file is already
isolated (one `Object.assign(window, …)` export at the bottom) — a
real bundler will only need a tiny `index.tsx` that imports them in
order.

---

## 13. Operational concerns

- **TLS** is mandatory because the session cookie is `Secure`. In dev,
  use a self-signed cert or set `Secure=false` only behind
  `NODE_ENV=development`.
- **Logging**: log `user_id` and `action` for every state-changing
  request; the `task_audit_log` table captures it for `tasks` already.
- **Indexes**: the schemas include the indexes the dashboards rely on
  (team_id, priority_id, due_date, redmine_ticket_id). Add more only
  if EXPLAIN says so.
- **Soft delete**: every list query in `TaskDao` must add
  `WHERE deleted_at IS NULL`. There is no API to hard-delete.
- **Time zones**: store everything in UTC (`TIMESTAMPTZ` in Postgres,
  `DATETIME` UTC by convention in MySQL). The UI's `formatDate` slices
  the ISO string at index 10 — make sure the server returns ISO-8601.

---

## 14. Checklist for the merging agent

Tick these off in order:

- [ ] Apply `db/schema.sql` (or `schema.mysql.sql`) to the target DB.
- [ ] Run the one-time `team-config.local.json` → DB migration
      (§ 11).
- [ ] Add a DB connection pool to `proxy.py`.
- [ ] Add session middleware + `/api/auth/{login,logout,me}` (§ 9).
- [ ] Implement DAOs from § 8 (one file per table).
- [ ] Implement endpoints from § 7 on top of the DAOs.
- [ ] Add the Redmine sync background thread (§ 10).
- [ ] Mount `ui/` as static files; expose `/index.html` (or move into
      the existing app shell).
- [ ] **Delete `ui/data.js`** and replace every `TEAMS`/`PEOPLE`/etc.
      reference with a fetch call (the file's banner has the mapping).
- [ ] Replace the pinned `TODAY` in `components.jsx` with
      `new Date()`.
- [ ] Remove the demo-credentials hint card in `login.jsx`.
- [ ] Wire the drill-down screen to the real Work-Overview endpoint
      (replace `DRILL_TICKETS`).
- [ ] Remove the `useStoredState` helper in `app.jsx`; replace with
      `useEffect` + fetch.
- [ ] Disable `ALLOW_DUMMY_LOGIN` in production.
- [ ] Add a smoke-test: log in as a lead, create a task, link it to
      a Redmine ticket, verify the sync worker updates it within one
      sync interval.

---

*End of guide. Questions → ping the design owner before merging.*

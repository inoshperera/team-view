# Contract: Redmine Proxy

## Purpose

The browser app talks only to the local Team View backend. The backend
authenticates each user against Redmine, stores the returned Redmine API key in
a server-side session, and forwards allowed Redmine API requests with that
user's credentials.

## Configuration

Local values:

| Name | Owner | Browser-visible | Purpose |
|------|-------|-----------------|---------|
| `REDMINE_URL` | proxy | no | Base Redmine URL, for example the company Redmine host |
| `PROXY_HOST` | proxy | no | Defaults to `localhost` |
| `PROXY_PORT` | proxy | yes as URL only | Defaults to `9000` |
| `TEAM_VIEW_DB_*` | backend | no | MySQL connection settings for teams, users, tasks, and sessions |

The browser MAY know the proxy URL, but MUST NOT know Redmine passwords or API
keys.

## Auth Requests

### POST `/api/auth/login`

Authenticates with Redmine Basic Auth using the submitted username/password.
On success, the backend stores the returned Redmine API key in
`user_sessions.redmine_api_key` and returns an HTTP-only `session_id` cookie.

### POST `/api/auth/logout`

Deletes the server-side session and clears the cookie.

### GET `/api/auth/me`

Returns the signed-in user payload when the session is valid.

## Allowed Requests

### GET `/time_entries.json`

Fetches time entries for selected members and dates.

Required query patterns for MVP:

```text
/time_entries.json?user_id={redmineUserId}&spent_on={YYYY-MM-DD}
/time_entries.json?user_id={redmineUserId}&from={YYYY-MM-DD}&to={YYYY-MM-DD}
```

Expected successful response shape:

```json
{
  "time_entries": [
    {
      "id": 123,
      "project": { "id": 10, "name": "Project" },
      "issue": { "id": 456 },
      "user": { "id": 14, "name": "Member Name" },
      "activity": { "id": 9, "name": "Development" },
      "hours": 2.5,
      "comments": "Work summary",
      "spent_on": "2026-05-12",
      "created_on": "2026-05-12T04:15:00Z",
      "updated_on": "2026-05-12T05:00:00Z"
    }
  ],
  "total_count": 1,
  "offset": 0,
  "limit": 25
}
```

### GET `/users.json`

Optional helper for generating or validating the selected-team list.

Required query pattern:

```text
/users.json?limit={limit}&offset={offset}
```

Expected successful response shape:

```json
{
  "users": [
    {
      "id": 14,
      "login": "member",
      "firstname": "Member",
      "lastname": "Name"
    }
  ],
  "total_count": 1,
  "offset": 0,
  "limit": 100
}
```

### GET `/issues/{id}.json`

Optional enhancement for issue subject/context when time entries only provide an
issue identifier.

Expected successful response shape:

```json
{
  "issue": {
    "id": 456,
    "subject": "Issue subject",
    "status": { "name": "In Progress" },
    "assigned_to": { "id": 14, "name": "Member Name" }
  }
}
```

## Proxy Behavior

- MUST support `GET` and `OPTIONS` for local browser access.
- MUST support local-only `GET` and `POST /team-config.json` as a DB-backed
  compatibility route for existing Work Overview team settings.
- MUST support `GET /proxy-config.json` so browser-rendered issue links can use
  the Redmine base URL without exposing the API key.
- MUST add the current session's `X-Redmine-API-Key` server-side.
- MUST return JSON responses from Redmine without exposing credentials.
- MUST restrict forwarding to expected Redmine API paths for MVP.
- MUST return useful non-secret error responses for network, auth, and invalid
  path failures.
- SHOULD preserve Redmine status codes when practical.

## Browser Error Handling Contract

The browser treats responses as:

| Condition | UI behavior |
|-----------|-------------|
| HTTP 200 with expected JSON | Normalize and render summaries |
| HTTP 200 with missing arrays | Render empty/no-data state for affected members |
| HTTP 401/403 | Show proxy/auth error without credential details |
| HTTP 404 | Show endpoint or record not found fallback |
| HTTP 5xx/network error | Show failed refresh state and preserve previous successful data |
| Non-JSON response | Show failed refresh state with invalid response message |

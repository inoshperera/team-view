# Contract: Redmine Proxy

## Purpose

The browser app talks only to the local proxy. The proxy attaches Redmine
credentials and forwards allowed read-only Redmine API requests.

## Configuration

Required local values:

| Name | Owner | Browser-visible | Purpose |
|------|-------|-----------------|---------|
| `REDMINE_URL` | proxy | no | Base Redmine URL, for example the company Redmine host |
| `REDMINE_API_KEY` | proxy | no | Redmine API key used by the proxy |
| `PROXY_HOST` | proxy | no | Defaults to `localhost` |
| `PROXY_PORT` | proxy | yes as URL only | Defaults to `9000` |

The browser MAY know the proxy URL, but MUST NOT know the Redmine API key.

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
- MAY support local-only `POST /team-config.json` so the static browser app can
  persist team settings to `team-config.local.json`.
- MUST support `GET /proxy-config.json` so browser-rendered issue links can use
  the Redmine base URL without exposing the API key.
- MUST add `X-Redmine-API-Key` server-side.
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

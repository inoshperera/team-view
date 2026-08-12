import json
import logging
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from backend.config import load_config
from backend.db import Database
from backend.redmine import RedmineClient, RedmineError
from backend import services


CONFIG = load_config()
DB = Database(CONFIG)
REDMINE = RedmineClient(CONFIG.redmine_url)
LOGGER = logging.getLogger("team_view.api")
AUDIT_LOGGER = logging.getLogger("team_view.audit")

ALLOWED_REDMINE_PATHS = {"/time_entries.json", "/users.json", "/issues.json"}
SENSITIVE_QUERY_KEYS = {"api_key", "key", "token", "password", "session_id"}


class ApiError(RuntimeError):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


class TeamViewHandler(BaseHTTPRequestHandler):
    server_version = "TeamViewBackend/2.0"

    def end_headers(self):
        origin = self.headers.get("Origin")
        self.send_header("Access-Control-Allow-Origin", origin or "*")
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        self.dispatch("GET")

    def do_POST(self):
        self.dispatch("POST")

    def do_PATCH(self):
        self.dispatch("PATCH")

    def do_DELETE(self):
        self.dispatch("DELETE")

    def dispatch(self, method):
        self.request_id = self.headers.get("X-Request-ID") or str(uuid.uuid4())
        self.started_at = time.monotonic()
        self.response_status = 500
        self.current_user = None
        self._body_json = None
        parsed = urlparse(self.path)
        path = parsed.path
        query = {key: values[-1] for key, values in parse_qs(parsed.query).items()}
        LOGGER.info(
            "request_start request_id=%s method=%s path=%s client_ip=%s origin=%s query=%s",
            self.request_id,
            method,
            path,
            self.client_ip(),
            self.headers.get("Origin", ""),
            redact_params(query),
        )
        try:
            if path == "/proxy-config.json":
                self.json(200, {"redmineUrl": CONFIG.redmine_url})
                return
            if path == "/api/auth/login" and method == "POST":
                self.handle_login()
                return
            if path == "/api/auth/logout" and method == "POST":
                user = self.session()
                self.current_user = user
                self.audit("logout", user=user, outcome="attempt")
                services.logout(DB, self.headers.get("Cookie"))
                self.clear_cookie()
                self.audit("logout", user=user, outcome="success")
                self.json(204, None)
                return

            session = self.session()
            user = session if session else None
            self.current_user = user
            if user:
                LOGGER.info(
                    "request_auth request_id=%s user_id=%s role=%s",
                    self.request_id,
                    user.get("user_id"),
                    user.get("role"),
                )
            if path == "/team-config.json":
                if not user:
                    raise ApiError("Sign in required before team settings can be loaded.", 401)
                self.authorize_backend_call(method, path, query, user)
                if method == "GET":
                    db_user = self.db_user(user)
                    visible_teams = services.teams_for_user(DB, db_user["id"]) if db_user["role"] in ("lead", "member") else None
                    self.json(200, services.team_config_payload(DB, restrict_to=visible_teams))
                    return
                if method == "POST":
                    self.audit("team_config_save", user=user, outcome="attempt")
                    self.json(200, services.save_team_config_payload(DB, self.body_json()))
                    self.audit("team_config_save", user=user, outcome="success")
                    return
                raise ApiError("Unsupported team config method.", 405)

            if path.startswith("/api/"):
                if not user:
                    raise ApiError("Sign in required.", 401)
                self.authorize_backend_call(method, path, query, user)
                self.handle_api(method, path, query, user)
                return

            if self.is_redmine_proxy_path(path):
                if not user:
                    raise ApiError("Sign in required before Redmine data can be loaded.", 401)
                params = {key: values[-1] for key, values in parse_qs(parsed.query).items()}
                self.authorize_redmine_proxy_call(method, path, params, user)
                LOGGER.info(
                    "redmine_passthrough request_id=%s user_id=%s role=%s path=%s params=%s",
                    self.request_id,
                    user.get("user_id"),
                    user.get("role"),
                    path,
                    redact_params(params),
                )
                payload = getattr(self, "_redmine_proxy_payload", None)
                if payload is None:
                    payload = REDMINE.get(path, user.get("redmine_api_key"), params)
                self.json(200, payload)
                return

            raise ApiError("This path is not handled by the local backend.", 404)
        except ApiError as exc:
            self.log_handled_error(exc.status, path, exc)
            self.json(exc.status, {"error": str(exc)})
        except RedmineError as exc:
            self.log_handled_error(exc.status, path, exc)
            self.json(exc.status, {"error": str(exc)})
        except PermissionError as exc:
            self.log_handled_error(403, path, exc)
            self.json(403, {"error": str(exc)})
        except KeyError as exc:
            self.log_handled_error(404, path, exc)
            self.json(404, {"error": str(exc).strip("'")})
        except ValueError as exc:
            self.log_handled_error(409, path, exc)
            self.json(409, {"error": str(exc)})
        except Exception as exc:
            LOGGER.exception(
                "request_unhandled_error request_id=%s method=%s path=%s client_ip=%s duration_ms=%s",
                self.request_id,
                method,
                path,
                self.client_ip(),
                self.elapsed_ms(),
            )
            self.json(500, {"error": "Backend request failed.", "detail": str(exc)})
        finally:
            LOGGER.info(
                "request_end request_id=%s method=%s path=%s status=%s duration_ms=%s user_id=%s role=%s",
                self.request_id,
                method,
                path,
                self.response_status,
                self.elapsed_ms(),
                (self.current_user or {}).get("user_id", ""),
                (self.current_user or {}).get("role", ""),
            )

    def authorize_backend_call(self, method, path, query, user):
        db_user = self.db_user(user)
        if path == "/team-config.json":
            if method == "GET":
                return
            self.require_role(db_user, {"manager", "admin"})
            return

        if path in ("/api/auth/me", "/api/bootstrap"):
            self.require_method(method, "GET")
            return
        if path == "/api/preferences":
            self.require_method(method, "PATCH")
            return
        if path in ("/api/teams", "/api/projects", "/api/users", "/api/redmine/projects"):
            self.require_method(method, "GET")
            self.authorize_project_query(db_user, query)
            return
        if path == "/api/redmine/recent-tickets":
            self.require_method(method, "GET")
            if db_user["role"] in ("lead", "member") and not query.get("projectId"):
                raise PermissionError("Team-scoped Redmine ticket search requires a project.")
            self.authorize_project_query(db_user, query)
            return
        if path == "/api/redmine/ticket":
            self.require_method(method, "GET")
            self.authorize_ticket_query(db_user, query, user.get("redmine_api_key"))
            return
        if path == "/api/tasks":
            if method == "GET":
                return
            if method == "POST":
                self.authorize_team_mutation(db_user, (self.body_json() or {}).get("teamId"))
                return
            raise ApiError("Unsupported method.", 405)
        if path.startswith("/api/teams/"):
            self.authorize_team_api_call(db_user, method, path)
            return
        if path.startswith("/api/tasks/"):
            self.authorize_task_api_call(db_user, method, path)
            return
        if path == "/api/sync/redmine":
            self.require_method(method, "POST")
            self.require_role(db_user, {"manager", "admin"})
            return
        if path == "/api/sync/directory":
            self.require_method(method, "POST")
            self.require_role(db_user, {"manager"})
            return
        raise ApiError("Unknown API route.", 404)

    def authorize_team_api_call(self, user, method, path):
        parts = path.strip("/").split("/")
        team_id = parts[2] if len(parts) > 2 else ""
        if not team_id:
            raise ApiError("Team id required.", 400)
        if len(parts) == 3 and method == "GET":
            self.authorize_team_view(user, team_id)
            return
        if method in ("POST", "PATCH", "DELETE"):
            self.require_role(user, {"manager", "admin"})
            return
        raise ApiError("Unknown team route.", 404)

    def authorize_task_api_call(self, user, method, path):
        parts = path.strip("/").split("/")
        if len(parts) < 3 or not parts[2].isdigit():
            raise ApiError("Task id required.", 400)
        task_id = int(parts[2])
        if len(parts) == 3 and method == "GET":
            self.authorize_task_view(user, task_id)
            return
        if len(parts) == 4 and parts[3] == "audit" and method == "GET":
            self.authorize_task_view(user, task_id)
            return
        if len(parts) == 3 and method == "PATCH":
            payload = self.body_json() or {}
            self.authorize_task_mutation(user, task_id, payload.get("teamId"))
            return
        if len(parts) == 3 and method == "DELETE":
            self.authorize_task_mutation(user, task_id)
            return
        if len(parts) == 4 and parts[3] in ("link", "sync-redmine", "unlink") and method == "POST":
            self.authorize_task_mutation(user, task_id)
            return
        raise ApiError("Unknown task route.", 404)

    def authorize_redmine_proxy_call(self, method, path, query, user):
        self.require_method(method, "GET")
        db_user = self.db_user(user)
        if db_user["role"] in ("manager", "admin"):
            return
        team_ids = services.teams_for_user(DB, db_user["id"])
        allowed_redmine_ids = {str(value) for value in services.redmine_user_ids_for_teams(DB, team_ids)}
        if path == "/time_entries.json":
            user_id = str(query.get("user_id") or "").strip()
            if not user_id:
                raise PermissionError("Team-scoped Redmine requests must include a user filter.")
            if user_id not in allowed_redmine_ids:
                raise PermissionError("You do not have access to this Redmine user.")
            return
        if path == "/issues.json":
            assignee_id = str(query.get("assigned_to_id") or "").strip()
            if not assignee_id:
                raise PermissionError("Team-scoped Redmine requests must include an assignee filter.")
            if assignee_id not in allowed_redmine_ids:
                raise PermissionError("You do not have access to this Redmine user.")
            return
        if path == "/users.json":
            raise PermissionError("Only managers can list Redmine users.")
        if path.startswith("/issues/") and path.endswith(".json"):
            payload = REDMINE.get(path, user.get("redmine_api_key"), query)
            issue = payload.get("issue") or {}
            assignee_id = str((issue.get("assigned_to") or {}).get("id") or "").strip()
            if assignee_id and assignee_id in allowed_redmine_ids:
                self._redmine_proxy_payload = payload
                return
            raise PermissionError("You do not have access to this Redmine issue.")
        raise ApiError("Unknown Redmine proxy route.", 404)

    def authorize_project_query(self, user, query):
        project_id = query.get("projectId") or query.get("project_id")
        if project_id and not services.user_can_access_project(DB, user, project_id):
            raise PermissionError("You do not have access to this project.")

    def authorize_ticket_query(self, user, query, api_key):
        if user["role"] in ("manager", "admin"):
            return
        ticket = services.get_or_fetch_ticket(DB, REDMINE, api_key, query.get("value"))
        if not ticket:
            return
        if not services.user_can_access_project(DB, user, ticket.get("projectId")):
            raise PermissionError("You do not have access to this Redmine ticket.")

    def authorize_task_view(self, user, task_id):
        task = services.get_task(DB, task_id)
        if not task:
            raise KeyError("Task not found.")
        if user["role"] in ("manager", "admin"):
            return task
        if task.get("teamId") not in services.teams_for_user(DB, user["id"]):
            raise PermissionError("You do not have access to this task.")
        return task

    def authorize_task_mutation(self, user, task_id, target_team_id=None):
        task = self.authorize_task_view(user, task_id)
        if user["role"] in ("manager", "admin"):
            return task
        if user["role"] != "lead":
            raise PermissionError("You do not have permission to change tasks.")
        if target_team_id and target_team_id not in services.teams_for_user(DB, user["id"]):
            raise PermissionError("You do not have access to the target team.")
        return task

    def authorize_team_view(self, user, team_id):
        if user["role"] in ("manager", "admin"):
            return
        if team_id not in services.teams_for_user(DB, user["id"]):
            raise PermissionError("You do not have access to this team.")

    def authorize_team_mutation(self, user, team_id):
        if user["role"] in ("manager", "admin"):
            return
        if user["role"] != "lead":
            raise PermissionError("You do not have permission to change tasks.")
        if team_id not in services.teams_for_user(DB, user["id"]):
            raise PermissionError("You do not have access to this team.")

    def require_role(self, user, roles):
        if user["role"] not in roles:
            raise PermissionError("You do not have permission to make this request.")

    def require_method(self, method, expected):
        if method != expected:
            raise ApiError("Unsupported method.", 405)

    def handle_api(self, method, path, query, user):
        if path == "/api/auth/me" and method == "GET":
            self.json(200, {"user": services.user_payload(user, services.primary_team_for_user(DB, user["user_id"]))})
        elif path == "/api/bootstrap" and method == "GET":
            db_user = self.db_user(user)
            lead_teams = services.teams_for_user(DB, db_user["id"]) if db_user["role"] in ("lead", "member") else None
            directory_warnings = []
            try:
                sync_result = services.sync_team_directory_if_stale(DB, REDMINE, user.get("redmine_api_key"), CONFIG, max_age_hours=24)
                directory_warnings = sync_result.get("warnings") or []
                LOGGER.info(
                    "directory_sync_bootstrap_check request_id=%s skipped=%s last_synced_at=%s",
                    self.request_id,
                    sync_result.get("skipped"),
                    sync_result.get("lastSyncedAt"),
                )
            except Exception as exc:
                directory_warnings = [{
                    "type": "directory_sync_failed",
                    "severity": "warning",
                    "title": "Directory sync failed",
                    "message": f"Using cached team directory because the latest sync failed: {exc}",
                    "items": [],
                }]
            self.json(200, {
                "user": services.user_payload(user, services.primary_team_for_user(DB, user["user_id"])),
                "teams": services.list_teams(DB, restrict_to=lead_teams),
                "users": services.list_users(DB, restrict_to_teams=lead_teams),
                "projects": services.list_projects(DB, restrict_to_teams=lead_teams),
                "preferences": services.user_preferences(DB, user["user_id"]),
                "directoryWarnings": directory_warnings,
                **services.list_lookups(DB),
            })
        elif path == "/api/teams" and method == "GET":
            db_user = self.db_user(user)
            visible_teams = services.teams_for_user(DB, db_user["id"]) if db_user["role"] in ("lead", "member") else None
            self.json(200, {"teams": services.list_teams(DB, restrict_to=visible_teams)})
        elif path == "/api/teams" and method == "POST":
            raise PermissionError("Teams are read-only and are synced from the organization directory.")
        elif path.startswith("/api/teams/"):
            self.handle_team_route(method, path, user)
            return
        elif path == "/api/projects" and method == "GET":
            db_user = self.db_user(user)
            lead_teams = services.teams_for_user(DB, db_user["id"]) if db_user["role"] in ("lead", "member") else None
            self.json(200, {"projects": services.list_projects(DB, restrict_to_teams=lead_teams)})
        elif path == "/api/preferences" and method == "PATCH":
            preferences = services.save_user_preferences(DB, user["user_id"], self.body_json())
            self.json(200, {"preferences": preferences})
        elif path == "/api/redmine/projects" and method == "GET":
            db_user = self.db_user(user)
            lead_teams = services.teams_for_user(DB, db_user["id"]) if db_user["role"] in ("lead", "member") else None
            projects = services.list_redmine_projects(DB, REDMINE, user.get("redmine_api_key"), query.get("q", ""), restrict_to_teams=lead_teams)
            self.json(200, {"projects": projects})
        elif path == "/api/users" and method == "GET":
            db_user = self.db_user(user)
            visible_teams = services.teams_for_user(DB, db_user["id"]) if db_user["role"] in ("lead", "member") else None
            self.json(200, {"users": services.list_users(DB, restrict_to_teams=visible_teams)})
        elif path == "/api/tasks" and method == "GET":
            self.json(200, {"tasks": services.list_tasks(DB, self.db_user(user), query)})
        elif path == "/api/tasks" and method == "POST":
            self.audit("task_create", user=user, outcome="attempt")
            task = services.save_task(DB, self.db_user(user), self.body_json())
            self.audit("task_create", user=user, outcome="success", task_id=task.get("id"), team_id=task.get("teamId"))
            self.json(201, {"task": task})
        elif path.startswith("/api/tasks/"):
            self.handle_task_route(method, path, user)
        elif path == "/api/redmine/recent-tickets" and method == "GET":
            tickets = services.list_redmine_recent_tickets(
                DB,
                REDMINE,
                user.get("redmine_api_key"),
                query.get("projectId"),
                query.get("q", ""),
            )
            self.json(200, {"tickets": tickets})
        elif path == "/api/redmine/ticket" and method == "GET":
            ticket = services.get_or_fetch_ticket(DB, REDMINE, user.get("redmine_api_key"), query.get("value"))
            self.json(200, {"ticket": ticket})
        elif path == "/api/sync/redmine" and method == "POST":
            self.audit("redmine_sync", user=user, outcome="attempt")
            result = services.sync_linked_tasks(DB, REDMINE, user.get("redmine_api_key"), self.db_user(user))
            self.audit("redmine_sync", user=user, outcome="success", count=result.get("count"))
            self.json(200, result)
        elif path == "/api/sync/directory" and method == "POST":
            db_user = self.db_user(user)
            if db_user["role"] != "manager":
                raise PermissionError("Only managers can refresh the organization directory.")
            self.audit("directory_sync", user=user, outcome="attempt")
            result = services.sync_team_directory(DB, REDMINE, user.get("redmine_api_key"), CONFIG)
            self.audit("directory_sync", user=user, outcome="success", warning_count=len(result.get("warnings") or []))
            self.json(200, result)
        else:
            raise ApiError("Unknown API route.", 404)

    def handle_team_route(self, method, path, user):
        parts = path.strip("/").split("/")
        # parts: ["api", "teams", team_id, ...]
        team_id = parts[2] if len(parts) > 2 else None
        if not team_id:
            raise ApiError("Team id required.", 400)
        db_user = self.db_user(user)
        if db_user["role"] in ("lead", "member") and team_id not in services.teams_for_user(DB, db_user["id"]):
            raise PermissionError("You do not have access to this team.")
        if len(parts) == 3:
            if method == "GET":
                team = services.get_team(DB, team_id)
                if not team:
                    raise KeyError("Team not found.")
                self.json(200, {"team": team})
            elif method == "PATCH":
                raise PermissionError("Teams are read-only and are synced from the organization directory.")
            elif method == "DELETE":
                raise PermissionError("Teams are read-only and are synced from the organization directory.")
            else:
                raise ApiError("Unsupported method.", 405)
        elif len(parts) == 4 and parts[3] == "members" and method == "POST":
            raise PermissionError("Team members are read-only and are synced from the organization directory.")
        elif len(parts) == 5 and parts[3] == "members" and method == "DELETE":
            raise PermissionError("Team members are read-only and are synced from the organization directory.")
        elif len(parts) == 4 and parts[3] == "lead" and method == "POST":
            raise PermissionError("Team leads are read-only and are synced from the organization directory.")
        elif len(parts) == 4 and parts[3] == "projects" and method == "PATCH":
            raise PermissionError("Team project ownership is read-only while teams are synced from the organization directory.")
        else:
            raise ApiError("Unknown team route.", 404)

    def handle_task_route(self, method, path, user):
        parts = path.strip("/").split("/")
        task_id = int(parts[2])
        db_user = self.db_user(user)
        if len(parts) == 3 and method == "GET":
            task = services.get_task(DB, task_id)
            if not task:
                raise KeyError("Task not found.")
            self.json(200, {"task": task})
        elif len(parts) == 4 and parts[3] == "audit" and method == "GET":
            task = services.get_task(DB, task_id)
            if not task:
                raise KeyError("Task not found.")
            if db_user["role"] in ("lead", "member") and task.get("teamId") not in services.teams_for_user(DB, db_user["id"]):
                raise PermissionError("You do not have access to this team.")
            self.json(200, {"task": task, "audit": services.task_audit_history(DB, task_id)})
        elif len(parts) == 3 and method == "PATCH":
            self.audit("task_update", user=user, outcome="attempt", task_id=task_id)
            task = services.save_task(DB, db_user, self.body_json(), task_id)
            self.audit("task_update", user=user, outcome="success", task_id=task.get("id"), team_id=task.get("teamId"))
            self.json(200, {"task": task})
        elif len(parts) == 3 and method == "DELETE":
            self.audit("task_delete", user=user, outcome="attempt", task_id=task_id)
            services.soft_delete_task(DB, db_user, task_id)
            self.audit("task_delete", user=user, outcome="success", task_id=task_id)
            self.json(204, None)
        elif len(parts) == 4 and parts[3] == "link" and method == "POST":
            body = self.body_json()
            self.audit("task_link_redmine", user=user, outcome="attempt", task_id=task_id)
            task = services.link_task_to_ticket(DB, REDMINE, user.get("redmine_api_key"), db_user, task_id, body.get("redmineIssue") or body.get("value"))
            self.audit("task_link_redmine", user=user, outcome="success", task_id=task.get("id"), redmine_issue_id=task.get("redmineIssueId"))
            self.json(200, {"task": task})
        elif len(parts) == 4 and parts[3] == "sync-redmine" and method == "POST":
            self.audit("task_sync_redmine", user=user, outcome="attempt", task_id=task_id)
            task = services.sync_linked_task(DB, REDMINE, user.get("redmine_api_key"), db_user, task_id)
            self.audit("task_sync_redmine", user=user, outcome="success", task_id=task.get("id"), redmine_issue_id=task.get("redmineIssueId"))
            self.json(200, {"task": task})
        elif len(parts) == 4 and parts[3] == "unlink" and method == "POST":
            self.audit("task_unlink_redmine", user=user, outcome="attempt", task_id=task_id)
            task = services.unlink_task(DB, db_user, task_id)
            self.audit("task_unlink_redmine", user=user, outcome="success", task_id=task.get("id"))
            self.json(200, {"task": task})
        else:
            raise ApiError("Unknown task route.", 404)

    def handle_login(self):
        body = self.body_json()
        username = str(body.get("username") or "").strip()
        password = str(body.get("password") or "")
        if not username or not password:
            self.audit("login", outcome="failed", username=username, reason="missing_credentials")
            raise ApiError("Username and password are required.", 400)
        self.audit("login", outcome="attempt", username=username)
        redmine_user = REDMINE.login(username, password)
        api_key = redmine_user.get("api_key")
        if not api_key:
            self.audit("login", outcome="failed", username=username, reason="missing_api_key")
            raise ApiError("Redmine did not return an API key for this account.", 403)
        user = services.upsert_user_from_redmine(DB, redmine_user)
        directory_warnings = []
        try:
            sync_result = services.sync_team_directory_if_stale(DB, REDMINE, api_key, CONFIG, max_age_hours=24)
            directory_warnings = sync_result.get("warnings") or []
            LOGGER.info(
                "directory_sync_login_check request_id=%s skipped=%s last_synced_at=%s",
                self.request_id,
                sync_result.get("skipped"),
                sync_result.get("lastSyncedAt"),
            )
        except Exception as exc:
            directory_warnings = [{
                "type": "directory_sync_failed",
                "severity": "warning",
                "title": "Directory sync failed",
                "message": f"Using cached team directory because the latest sync failed: {exc}",
                "items": [],
            }]
        user = services.upsert_user_from_redmine(DB, redmine_user)
        if not user or not user.get("is_active"):
            self.audit("login", outcome="failed", username=username, reason="inactive_user")
            raise ApiError("Your account is inactive in the organization directory.", 403)
        token = services.create_session(
            DB,
            user["id"],
            api_key,
            CONFIG,
            self.headers.get("User-Agent", ""),
            self.client_address[0] if self.client_address else "",
        )
        self.set_cookie(token)
        team_id = services.primary_team_for_user(DB, user["id"])
        self.current_user = {"user_id": user["id"], "role": user.get("role")}
        self.audit("login", user={"user_id": user["id"], "role": user.get("role")}, outcome="success", username=username)
        self.json(200, {"user": services.user_payload(user, team_id), "directoryWarnings": directory_warnings})

    def body_json(self):
        if self._body_json is not None:
            return self._body_json
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise ApiError("Invalid Content-Length.", 400)
        if length <= 0:
            self._body_json = {}
            return self._body_json
        try:
            self._body_json = json.loads(self.rfile.read(length))
            return self._body_json
        except json.JSONDecodeError:
            raise ApiError("Request body must be valid JSON.", 400)

    def session(self):
        return services.authenticate_cookie(DB, self.headers.get("Cookie"))

    def db_user(self, session_row):
        return {
            "id": session_row["user_id"],
            "role": session_row["role"],
        }

    def is_redmine_proxy_path(self, path):
        return path in ALLOWED_REDMINE_PATHS or bool(path.startswith("/issues/") and path.endswith(".json"))

    def set_cookie(self, token):
        attrs = ["session_id=" + token, "HttpOnly", "SameSite=Lax", "Path=/", f"Max-Age={CONFIG.session_hours * 3600}"]
        if not CONFIG.dev_cookie:
            attrs.append("Secure")
        self.extra_cookie = "; ".join(attrs)

    def clear_cookie(self):
        self.extra_cookie = "session_id=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"

    def json(self, status, payload):
        self.response_status = status
        if status == 204:
            self.send_response(status)
            self.send_header("X-Request-ID", getattr(self, "request_id", ""))
            if hasattr(self, "extra_cookie"):
                self.send_header("Set-Cookie", self.extra_cookie)
            self.end_headers()
            return
        body = json.dumps(payload or {}, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Request-ID", getattr(self, "request_id", ""))
        if hasattr(self, "extra_cookie"):
            self.send_header("Set-Cookie", self.extra_cookie)
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        LOGGER.debug("http_server client_ip=%s message=%s", self.client_ip(), fmt % args)

    def client_ip(self):
        forwarded = self.headers.get("X-Forwarded-For", "")
        if forwarded:
            return forwarded.split(",", 1)[0].strip()
        return self.client_address[0] if self.client_address else ""

    def elapsed_ms(self):
        return int((time.monotonic() - getattr(self, "started_at", time.monotonic())) * 1000)

    def log_handled_error(self, status, path, exc):
        LOGGER.warning(
            "request_handled_error request_id=%s path=%s status=%s duration_ms=%s error=%s",
            getattr(self, "request_id", ""),
            path,
            status,
            self.elapsed_ms(),
            exc,
        )

    def audit(self, event, user=None, outcome="", **fields):
        safe_fields = " ".join(f"{key}={value}" for key, value in fields.items() if value is not None)
        AUDIT_LOGGER.info(
            "audit_event request_id=%s event=%s outcome=%s user_id=%s role=%s client_ip=%s %s",
            getattr(self, "request_id", ""),
            event,
            outcome,
            (user or {}).get("user_id") or (user or {}).get("id") or "",
            (user or {}).get("role") or "",
            self.client_ip(),
            safe_fields,
        )


def main():
    logging.basicConfig(
        level=getattr(logging, CONFIG.log_level, logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    LOGGER.info("backend_start host=%s port=%s redmine_url=%s db_host=%s db_name=%s", CONFIG.host, CONFIG.port, CONFIG.redmine_url, CONFIG.db_host, CONFIG.db_name)
    DB.initialize()
    services.ensure_planner_schema(DB)
    services.migrate_team_config(DB)
    server = ThreadingHTTPServer((CONFIG.host, CONFIG.port), TeamViewHandler)
    LOGGER.info("backend_ready routes=/api/auth/*,/api/tasks,/api/teams,/api/redmine/* passthrough=/time_entries.json,/users.json,/issues.json,/issues/{id}.json")
    server.serve_forever()


def redact_params(params):
    return {
        key: "[redacted]" if str(key).lower() in SENSITIVE_QUERY_KEYS else value
        for key, value in dict(params).items()
    }


if __name__ == "__main__":
    main()

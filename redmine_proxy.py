import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

from backend.config import load_config
from backend.db import Database
from backend.redmine import RedmineClient, RedmineError
from backend import services


CONFIG = load_config()
DB = Database(CONFIG)
REDMINE = RedmineClient(CONFIG.redmine_url)

ALLOWED_REDMINE_PATHS = {"/time_entries.json", "/users.json", "/issues.json"}


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
        parsed = urlparse(self.path)
        path = parsed.path
        query = {key: values[-1] for key, values in parse_qs(parsed.query).items()}
        try:
            if path == "/proxy-config.json":
                self.json(200, {"redmineUrl": CONFIG.redmine_url})
                return
            if path == "/api/auth/login" and method == "POST":
                self.handle_login()
                return
            if path == "/api/auth/logout" and method == "POST":
                services.logout(DB, self.headers.get("Cookie"))
                self.clear_cookie()
                self.json(204, None)
                return

            session = self.session()
            user = session if session else None
            if path == "/team-config.json":
                if not user:
                    raise ApiError("Sign in required before team settings can be loaded.", 401)
                if method == "GET":
                    self.json(200, services.team_config_payload(DB))
                    return
                if method == "POST":
                    self.json(200, services.save_team_config_payload(DB, self.body_json()))
                    return
                raise ApiError("Unsupported team config method.", 405)

            if path.startswith("/api/"):
                if not user:
                    raise ApiError("Sign in required.", 401)
                self.handle_api(method, path, query, user)
                return

            if self.is_redmine_proxy_path(path):
                if not user:
                    raise ApiError("Sign in required before Redmine data can be loaded.", 401)
                params = {key: values[-1] for key, values in parse_qs(parsed.query).items()}
                payload = REDMINE.get(path, user.get("redmine_api_key"), params)
                self.json(200, payload)
                return

            raise ApiError("This path is not handled by the local backend.", 404)
        except ApiError as exc:
            self.json(exc.status, {"error": str(exc)})
        except RedmineError as exc:
            self.json(exc.status, {"error": str(exc)})
        except PermissionError as exc:
            self.json(403, {"error": str(exc)})
        except KeyError as exc:
            self.json(404, {"error": str(exc).strip("'")})
        except ValueError as exc:
            self.json(409, {"error": str(exc)})
        except Exception as exc:
            self.json(500, {"error": "Backend request failed.", "detail": str(exc)})

    def handle_api(self, method, path, query, user):
        if path == "/api/auth/me" and method == "GET":
            self.json(200, {"user": services.user_payload(user, services.primary_team_for_user(DB, user["user_id"]))})
        elif path == "/api/bootstrap" and method == "GET":
            self.json(200, {
                "user": services.user_payload(user, services.primary_team_for_user(DB, user["user_id"])),
                "teams": services.list_teams(DB),
                "users": services.list_users(DB),
                "projects": services.list_projects(DB),
                **services.list_lookups(DB),
            })
        elif path == "/api/teams" and method == "GET":
            self.json(200, {"teams": services.list_teams(DB)})
        elif path.startswith("/api/teams/") and method == "GET":
            team_id = path.rsplit("/", 1)[-1]
            team = services.get_team(DB, team_id)
            if not team:
                raise KeyError("Team not found.")
            self.json(200, {"team": team})
        elif path == "/api/projects" and method == "GET":
            self.json(200, {"projects": services.list_projects(DB)})
        elif path == "/api/redmine/projects" and method == "GET":
            projects = services.list_redmine_projects(DB, REDMINE, user.get("redmine_api_key"), query.get("q", ""))
            self.json(200, {"projects": projects})
        elif path == "/api/users" and method == "GET":
            self.json(200, {"users": services.list_users(DB)})
        elif path == "/api/tasks" and method == "GET":
            self.json(200, {"tasks": services.list_tasks(DB, self.db_user(user), query)})
        elif path == "/api/tasks" and method == "POST":
            task = services.save_task(DB, self.db_user(user), self.body_json())
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
            result = services.sync_linked_tasks(DB, REDMINE, user.get("redmine_api_key"), self.db_user(user))
            self.json(200, result)
        else:
            raise ApiError("Unknown API route.", 404)

    def handle_task_route(self, method, path, user):
        parts = path.strip("/").split("/")
        task_id = int(parts[2])
        db_user = self.db_user(user)
        if len(parts) == 3 and method == "GET":
            task = services.get_task(DB, task_id)
            if not task:
                raise KeyError("Task not found.")
            self.json(200, {"task": task})
        elif len(parts) == 3 and method == "PATCH":
            task = services.save_task(DB, db_user, self.body_json(), task_id)
            self.json(200, {"task": task})
        elif len(parts) == 3 and method == "DELETE":
            services.soft_delete_task(DB, db_user, task_id)
            self.json(204, None)
        elif len(parts) == 4 and parts[3] == "link" and method == "POST":
            body = self.body_json()
            task = services.link_task_to_ticket(DB, REDMINE, user.get("redmine_api_key"), db_user, task_id, body.get("redmineIssue") or body.get("value"))
            self.json(200, {"task": task})
        elif len(parts) == 4 and parts[3] == "unlink" and method == "POST":
            task = services.unlink_task(DB, db_user, task_id)
            self.json(200, {"task": task})
        else:
            raise ApiError("Unknown task route.", 404)

    def handle_login(self):
        body = self.body_json()
        username = str(body.get("username") or "").strip()
        password = str(body.get("password") or "")
        if not username or not password:
            raise ApiError("Username and password are required.", 400)
        redmine_user = REDMINE.login(username, password)
        api_key = redmine_user.get("api_key")
        if not api_key:
            raise ApiError("Redmine did not return an API key for this account.", 403)
        user = services.upsert_user_from_redmine(DB, redmine_user)
        services.sync_redmine_users(DB, REDMINE, api_key)
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
        self.json(200, {"user": services.user_payload(user, team_id)})

    def body_json(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise ApiError("Invalid Content-Length.", 400)
        if length <= 0:
            return {}
        try:
            return json.loads(self.rfile.read(length))
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
        if status == 204:
            self.send_response(status)
            if hasattr(self, "extra_cookie"):
                self.send_header("Set-Cookie", self.extra_cookie)
            self.end_headers()
            return
        body = json.dumps(payload or {}, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        if hasattr(self, "extra_cookie"):
            self.send_header("Set-Cookie", self.extra_cookie)
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args))


def main():
    DB.initialize()
    services.migrate_team_config(DB)
    server = HTTPServer((CONFIG.host, CONFIG.port), TeamViewHandler)
    print(f"Team View backend running at http://{CONFIG.host}:{CONFIG.port}")
    print("API routes: /api/auth/*, /api/tasks, /api/teams, /api/redmine/*")
    print("Redmine passthrough: /time_entries.json, /users.json, /issues.json, /issues/{id}.json")
    server.serve_forever()


if __name__ == "__main__":
    main()

import json
import os
import re
from pathlib import Path
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen


DEFAULT_HOST = "localhost"
DEFAULT_PORT = 9000
TEAM_CONFIG_PATH = Path(__file__).with_name("team-config.local.json")
TEAM_CONFIG_API_PATH = "/team-config.json"
PUBLIC_CONFIG_API_PATH = "/proxy-config.json"
ALLOWED_EXACT_PATHS = {"/time_entries.json", "/users.json", "/issues.json"}
ISSUE_PATH_RE = re.compile(r"^/issues/\d+\.json$")


def get_config():
    # redmine_url = os.environ.get("REDMINE_URL", "https://roadmap.entgra.net").strip().rstrip("/")
    # api_key = os.environ.get("REDMINE_API_KEY", "1d628ca97bac57d7d563b4200e852a37d91e7813").strip()
    redmine_url = "https://roadmap.staging.entgra.net"
    api_key = "74a2ee80b9518c8deb7225f8ea1c3a246e44123c"
    host = os.environ.get("PROXY_HOST", DEFAULT_HOST).strip() or DEFAULT_HOST
    port = int(os.environ.get("PROXY_PORT", DEFAULT_PORT))
    return redmine_url, api_key, host, port


def is_allowed_path(path):
    parsed = urlparse(path)
    return parsed.path in ALLOWED_EXACT_PATHS or ISSUE_PATH_RE.match(parsed.path)


class RedmineProxy(BaseHTTPRequestHandler):
    server_version = "TeamActivityProxy/1.0"

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        if urlparse(self.path).path == TEAM_CONFIG_API_PATH:
            self.handle_team_config_get()
            return
        if urlparse(self.path).path == PUBLIC_CONFIG_API_PATH:
            redmine_url, _, _, _ = get_config()
            self.send_json(200, {"redmineUrl": redmine_url})
            return

        redmine_url, api_key, _, _ = get_config()

        if not is_allowed_path(self.path):
            self.send_json(403, {"error": "This Redmine API path is not allowed by the local proxy."})
            return

        if not redmine_url or not api_key:
            self.send_json(500, {
                "error": "Proxy is missing REDMINE_URL or REDMINE_API_KEY environment configuration."
            })
            return

        target_url = urljoin(f"{redmine_url}/", self.path.lstrip("/"))

        request = Request(
            target_url,
            headers={"X-Redmine-API-Key": api_key, "Accept": "application/json"},
            method="GET",
        )

        try:
            with urlopen(request, timeout=20) as response:
                body = response.read()
                status = response.status
                content_type = response.headers.get("Content-Type", "application/json")
        except HTTPError as exc:
            body = exc.read()
            status = exc.code
            content_type = exc.headers.get("Content-Type", "application/json")
        except URLError as exc:
            self.send_json(502, {"error": "Unable to reach Redmine through the proxy.", "detail": str(exc)})
            return

        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if urlparse(self.path).path != TEAM_CONFIG_API_PATH:
            self.send_json(403, {"error": "This local proxy path does not accept POST."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_json(400, {"error": "Invalid Content-Length header."})
            return

        try:
            payload = json.loads(self.rfile.read(content_length) or b"{}")
        except json.JSONDecodeError:
            self.send_json(400, {"error": "Team config must be valid JSON."})
            return

        teams = payload.get("teams")
        if not isinstance(teams, list):
            self.send_json(400, {"error": "Team config must contain a teams array."})
            return

        cleaned = []
        seen_ids = set()
        for team in teams:
            if not isinstance(team, dict):
                self.send_json(400, {"error": "Each team must be an object."})
                return
            team_id = str(team.get("id", "")).strip()
            name = str(team.get("name", "")).strip()
            member_ids = team.get("memberIds", [])
            if not team_id or not name or not isinstance(member_ids, list) or team_id in seen_ids:
                self.send_json(400, {"error": "Each team needs a unique id, name, and memberIds array."})
                return
            seen_ids.add(team_id)
            cleaned.append({
                "id": team_id,
                "name": name,
                "memberIds": [int(member_id) for member_id in member_ids if isinstance(member_id, int) or str(member_id).isdigit()],
            })

        TEAM_CONFIG_PATH.write_text(json.dumps({"teams": cleaned}, indent=4) + "\n", encoding="utf-8")
        self.send_json(200, {"teams": cleaned, "saved": True})

    def handle_team_config_get(self):
        if not TEAM_CONFIG_PATH.exists():
            self.send_json(200, {"teams": []})
            return
        try:
            payload = json.loads(TEAM_CONFIG_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            self.send_json(500, {"error": "Saved team config file is not valid JSON."})
            return
        teams = payload.get("teams", [])
        self.send_json(200, {"teams": teams if isinstance(teams, list) else []})

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args))


def main():
    _, _, host, port = get_config()
    server = HTTPServer((host, port), RedmineProxy)
    print(f"Proxy running at http://{host}:{port}")
    print("Allowed paths: /time_entries.json, /users.json, /issues.json, /issues/{id}.json, /team-config.json, /proxy-config.json")
    server.serve_forever()


if __name__ == "__main__":
    main()

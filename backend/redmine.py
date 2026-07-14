import base64
import json
import logging
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

LOGGER = logging.getLogger("team_view.redmine")
SENSITIVE_PARAMS = {"api_key", "key", "token", "password"}


class RedmineError(RuntimeError):
    def __init__(self, message, status=502):
        super().__init__(message)
        self.status = status


class RedmineClient:
    def __init__(self, base_url):
        self.base_url = base_url.rstrip("/")

    def login(self, username, password):
        basic = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("ascii")
        payload = self.request("/users/current.json", headers={"Authorization": f"Basic {basic}"})
        return payload.get("user") or {}

    def get(self, path, api_key, params=None):
        return self.request(path, api_key=api_key, params=params)

    def request(self, path, api_key=None, params=None, headers=None):
        query = f"?{urlencode(params or {}, doseq=True)}" if params else ""
        request_headers = {"Accept": "application/json", **(headers or {})}
        if api_key:
            request_headers["X-Redmine-API-Key"] = api_key
        request = Request(f"{self.base_url}{path}{query}", headers=request_headers, method="GET")
        started = time.monotonic()
        safe_params = redact_params(params or {})
        try:
            with urlopen(request, timeout=20) as response:
                text = response.read().decode("utf-8")
                LOGGER.info(
                    "redmine_request method=GET path=%s status=%s duration_ms=%s params=%s",
                    path,
                    response.status,
                    elapsed_ms(started),
                    safe_params,
                )
                return json.loads(text) if text else {}
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            LOGGER.warning(
                "redmine_request_failed method=GET path=%s status=%s duration_ms=%s params=%s",
                path,
                exc.code,
                elapsed_ms(started),
                safe_params,
            )
            if exc.code in (401, 403):
                raise RedmineError("Redmine authentication failed.", exc.code) from exc
            raise RedmineError(f"Redmine returned HTTP {exc.code}: {detail[:160]}", exc.code) from exc
        except URLError as exc:
            LOGGER.warning(
                "redmine_request_error method=GET path=%s duration_ms=%s params=%s error=%s",
                path,
                elapsed_ms(started),
                safe_params,
                exc.reason,
            )
            raise RedmineError(f"Unable to reach Redmine: {exc.reason}", 502) from exc
        except json.JSONDecodeError as exc:
            LOGGER.warning(
                "redmine_invalid_json path=%s duration_ms=%s params=%s",
                path,
                elapsed_ms(started),
                safe_params,
            )
            raise RedmineError("Redmine returned a non-JSON response.", 502) from exc


def elapsed_ms(started):
    return int((time.monotonic() - started) * 1000)


def redact_params(params):
    return {
        key: "[redacted]" if str(key).lower() in SENSITIVE_PARAMS else value
        for key, value in dict(params).items()
    }

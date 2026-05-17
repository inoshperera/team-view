import os
from dataclasses import dataclass


@dataclass(frozen=True)
class AppConfig:
    host: str
    port: int
    redmine_url: str
    db_host: str
    db_port: int
    db_user: str
    db_password: str
    db_name: str
    session_hours: int
    dev_cookie: bool


def load_config() -> AppConfig:
    return AppConfig(
        host=os.environ.get("PROXY_HOST", "localhost").strip() or "localhost",
        port=int(os.environ.get("PROXY_PORT", "9000")),
        redmine_url=os.environ.get("REDMINE_URL", "https://roadmap.staging.entgra.net").strip().rstrip("/"),
        db_host=os.environ.get("TEAM_VIEW_DB_HOST", "localhost").strip() or "localhost",
        db_port=int(os.environ.get("TEAM_VIEW_DB_PORT", "3306")),
        db_user=os.environ.get("TEAM_VIEW_DB_USER", "root").strip() or "root",
        db_password=os.environ.get("TEAM_VIEW_DB_PASSWORD", "root"),
        db_name=os.environ.get("TEAM_VIEW_DB_NAME", "team_view").strip() or "team_view",
        session_hours=int(os.environ.get("TEAM_VIEW_SESSION_HOURS", "8")),
        dev_cookie=os.environ.get("TEAM_VIEW_DEV_COOKIE", "true").lower() != "false",
    )

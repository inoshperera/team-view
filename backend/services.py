import hashlib
import json
import logging
import re
import uuid
from datetime import datetime, timedelta
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SYNCED_FIELDS = {"priorityId", "statusId", "progress", "startDate", "dueDate", "memberIds"}
DEFAULT_TEAM_ID = "default_team"
DEFAULT_TEAM_NAME = "Default team"
LOGGER = logging.getLogger("team_view.services")


def now_utc():
    return datetime.utcnow()


def hash_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def user_payload(user, team_id=None):
    user_id = user.get("user_id") or user.get("id")
    return {
        "id": user_id,
        "username": user.get("username") or "",
        "displayName": user.get("display_name") or f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
        "email": user.get("email") or "",
        "role": user.get("role") or "member",
        "teamId": team_id,
        "redmineUserId": user.get("redmine_user_id"),
        "avatarUrl": user.get("avatar_url") or "",
        "avatarColor": user.get("avatar_color") or avatar_class(user.get("id") or 0),
    }


def avatar_class(value):
    return f"av-{chr(97 + (int(value) % 8))}"


def initials(name):
    return "".join(part[0] for part in str(name).split()[:2]).upper() or "U"


def normalized_identity(value):
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def user_summary(user):
    display = user.get("display_name") or f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
    return {
        "id": user["id"],
        "name": display,
        "email": user.get("email") or "",
        "avatarColor": user.get("avatar_color") or avatar_class(user["id"]),
        "avatarUrl": user.get("avatar_url") or "",
        "initials": initials(display),
        "role": user.get("role") or "member",
    }


def upsert_user_from_redmine(db, redmine_user):
    redmine_id = int(redmine_user.get("id") or 0)
    username = str(redmine_user.get("login") or "").strip()
    first = str(redmine_user.get("firstname") or username or "Redmine").strip()
    last = str(redmine_user.get("lastname") or "User").strip()
    email = str(redmine_user.get("mail") or "").strip() or None
    avatar_url = str(redmine_user.get("avatar_url") or "").strip() or None
    existing = db.one(
        "SELECT * FROM users WHERE redmine_user_id=%s OR username=%s OR email=%s LIMIT 1",
        (redmine_id, username, email),
    )
    if existing and existing.get("external_member_id") and existing.get("role") in ("lead", "manager"):
        role = existing["role"]
    elif existing and existing.get("role") == "manager":
        role = "manager"
    else:
        role = "member"
    db.execute(
        """
        INSERT INTO users (redmine_user_id, first_name, last_name, email, avatar_url, username, role, avatar_color, last_login_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,UTC_TIMESTAMP())
        ON DUPLICATE KEY UPDATE
          redmine_user_id=VALUES(redmine_user_id),
          first_name=VALUES(first_name),
          last_name=VALUES(last_name),
          email=VALUES(email),
          avatar_url=VALUES(avatar_url),
          username=VALUES(username),
          role=VALUES(role),
          is_active=IF(external_member_id IS NOT NULL AND directory_synced_at IS NOT NULL AND is_active=0, is_active, 1),
          last_login_at=UTC_TIMESTAMP()
        """,
        (redmine_id, first, last, email, avatar_url, username, role, avatar_class(redmine_id)),
    )
    return db.one("SELECT * FROM users WHERE redmine_user_id=%s", (redmine_id,))


def sync_redmine_users(db, redmine, api_key):
    synced = 0
    linked = 0
    failures = []
    raw_users = []
    offset = 0
    limit = 100
    try:
        while True:
            payload = redmine.get("/users.json", api_key, {"status": 1, "limit": limit, "offset": offset})
            users = payload.get("users", [])
            raw_users.extend(users)
            for raw in users:
                try:
                    before = count_linked_directory_users(db)
                    upsert_user_from_redmine(db, raw)
                    linked += max(0, count_linked_directory_users(db) - before)
                    synced += 1
                except Exception as exc:
                    failures.append(f"{raw.get('id') or '?'}:{raw.get('login') or ''}")
                    LOGGER.exception(
                        "redmine_user_sync_failed redmine_user_id=%s login=%s mail=%s error=%s",
                        raw.get("id"),
                        raw.get("login"),
                        raw.get("mail"),
                        exc,
                    )
            total = int(payload.get("total_count") or synced)
            offset += limit
            if offset >= total or not users:
                break
    except Exception as exc:
        LOGGER.exception("redmine_users_fetch_failed synced=%s error=%s", synced, exc)
        return {"synced": synced, "linked": linked, "failed": True, "failures": failures}
    linked += link_directory_users_from_redmine_payload(db, raw_users)
    linked += link_directory_users_from_redmine_users(db)
    unresolved_failures = unresolved_redmine_failures(db, failures)
    return {"synced": synced, "linked": linked, "failed": bool(unresolved_failures), "failures": unresolved_failures}


def count_linked_directory_users(db):
    row = db.one("SELECT COUNT(*) AS count FROM users WHERE external_member_id IS NOT NULL AND redmine_user_id IS NOT NULL")
    return int((row or {}).get("count") or 0)


def link_directory_users_from_redmine_users(db):
    rows = db.query(
        """
        SELECT id, redmine_user_id, first_name, last_name, display_name, email, username, external_member_id
        FROM users
        WHERE is_active=1
        """
    )
    redmine_candidates = []
    directory_rows = []
    for row in rows:
        if row.get("redmine_user_id"):
            redmine_candidates.append(row)
        if row.get("external_member_id") and not row.get("redmine_user_id"):
            directory_rows.append(row)

    exact_name_counts = {}
    exact_name_candidate = {}
    for row in redmine_candidates:
        name_key = normalized_identity(row.get("display_name") or f"{row.get('first_name', '')} {row.get('last_name', '')}")
        if name_key:
            exact_name_counts[name_key] = exact_name_counts.get(name_key, 0) + 1
            exact_name_candidate[name_key] = row

    linked = 0
    for directory_user in directory_rows:
        email = normalized_identity(directory_user.get("email"))
        username = normalized_identity(directory_user.get("username"))
        localpart = normalized_identity(str(directory_user.get("email") or "").split("@", 1)[0])
        name_key = normalized_identity(directory_user.get("display_name") or f"{directory_user.get('first_name', '')} {directory_user.get('last_name', '')}")
        match = None
        for candidate in redmine_candidates:
            candidate_email = normalized_identity(candidate.get("email"))
            candidate_username = normalized_identity(candidate.get("username"))
            if email and candidate_email and email == candidate_email:
                match = candidate
                break
            if username and candidate_username and username == candidate_username:
                match = candidate
                break
            if localpart and candidate_username and localpart == candidate_username:
                match = candidate
                break
        if not match and name_key and exact_name_counts.get(name_key) == 1:
            match = exact_name_candidate[name_key]
        if not match:
            continue
        try:
            db.execute(
                """
                UPDATE users
                SET redmine_user_id=%s,
                    avatar_url=COALESCE(avatar_url, %s)
                WHERE id=%s AND redmine_user_id IS NULL
                """,
                (match["redmine_user_id"], match.get("avatar_url"), directory_user["id"]),
            )
            linked += 1
        except Exception as exc:
            LOGGER.exception(
                "directory_redmine_link_failed directory_user_id=%s redmine_user_id=%s error=%s",
                directory_user.get("id"),
                match.get("redmine_user_id"),
                exc,
            )
    return linked


def link_directory_users_from_redmine_payload(db, redmine_users):
    directory_rows = db.query(
        """
        SELECT id, first_name, last_name, display_name, email, username, external_member_id, redmine_user_id
        FROM users
        WHERE is_active=1 AND external_member_id IS NOT NULL
        """
    )
    linked = 0
    for raw in redmine_users:
        redmine_id = int(raw.get("id") or 0)
        if not redmine_id:
            continue
        match = find_directory_match_for_redmine_user(directory_rows, raw)
        if not match or match.get("redmine_user_id") == redmine_id:
            continue
        try:
            linked += link_redmine_id_to_directory_user(db, match, raw)
        except Exception as exc:
            LOGGER.exception(
                "directory_redmine_payload_link_failed directory_user_id=%s redmine_user_id=%s login=%s error=%s",
                match.get("id"),
                redmine_id,
                raw.get("login"),
                exc,
            )
    return linked


def find_directory_match_for_redmine_user(directory_rows, raw):
    redmine_email = normalized_identity(raw.get("mail"))
    redmine_login = normalized_identity(raw.get("login"))
    redmine_name = normalized_identity(f"{raw.get('firstname') or ''} {raw.get('lastname') or ''}")
    matches = []
    for row in directory_rows:
        email = normalized_identity(row.get("email"))
        username = normalized_identity(row.get("username"))
        localpart = normalized_identity(str(row.get("email") or "").split("@", 1)[0])
        name = normalized_identity(row.get("display_name") or f"{row.get('first_name', '')} {row.get('last_name', '')}")
        if redmine_email and email and redmine_email == email:
            return row
        if redmine_login and username and redmine_login == username:
            return row
        if redmine_login and localpart and redmine_login == localpart:
            return row
        if redmine_name and name and redmine_name == name:
            matches.append(row)
    return matches[0] if len(matches) == 1 else None


def link_redmine_id_to_directory_user(db, directory_user, raw):
    redmine_id = int(raw.get("id") or 0)
    redmine_row = db.one("SELECT id FROM users WHERE redmine_user_id=%s", (redmine_id,))
    if redmine_row and redmine_row["id"] != directory_user["id"]:
        merge_user_rows(db, redmine_row["id"], directory_user["id"])
    db.execute(
        """
        UPDATE users
        SET redmine_user_id=%s,
            username=COALESCE(username, %s),
            avatar_url=COALESCE(avatar_url, %s)
        WHERE id=%s
        """,
        (redmine_id, str(raw.get("login") or "").strip() or None, str(raw.get("avatar_url") or "").strip() or None, directory_user["id"]),
    )
    directory_user["redmine_user_id"] = redmine_id
    return 1


def merge_user_rows(db, source_user_id, target_user_id):
    if source_user_id == target_user_id:
        return
    with db.transaction() as conn:
        with conn.cursor() as cursor:
            cursor.execute("UPDATE user_sessions SET user_id=%s WHERE user_id=%s", (target_user_id, source_user_id))
            cursor.execute("UPDATE teams SET lead_user_id=%s WHERE lead_user_id=%s", (target_user_id, source_user_id))
            cursor.execute(
                """
                INSERT IGNORE INTO team_members (team_id, user_id, role, joined_at)
                SELECT team_id, %s, role, joined_at FROM team_members WHERE user_id=%s
                """,
                (target_user_id, source_user_id),
            )
            cursor.execute("DELETE FROM team_members WHERE user_id=%s", (source_user_id,))
            cursor.execute(
                """
                INSERT IGNORE INTO redmine_ticket_assignees (ticket_id, user_id)
                SELECT ticket_id, %s FROM redmine_ticket_assignees WHERE user_id=%s
                """,
                (target_user_id, source_user_id),
            )
            cursor.execute("DELETE FROM redmine_ticket_assignees WHERE user_id=%s", (source_user_id,))
            cursor.execute("UPDATE tasks SET created_by_user_id=%s WHERE created_by_user_id=%s", (target_user_id, source_user_id))
            cursor.execute("UPDATE tasks SET updated_by_user_id=%s WHERE updated_by_user_id=%s", (target_user_id, source_user_id))
            cursor.execute(
                """
                INSERT IGNORE INTO task_assignments (task_id, user_id, source, assigned_at)
                SELECT task_id, %s, source, assigned_at FROM task_assignments WHERE user_id=%s
                """,
                (target_user_id, source_user_id),
            )
            cursor.execute("DELETE FROM task_assignments WHERE user_id=%s", (source_user_id,))
            cursor.execute("UPDATE task_audit_log SET user_id=%s WHERE user_id=%s", (target_user_id, source_user_id))
            cursor.execute("DELETE FROM users WHERE id=%s", (source_user_id,))


def unresolved_redmine_failures(db, failures):
    unresolved = []
    for failure in failures:
        redmine_id = str(failure).split(":", 1)[0]
        if not redmine_id.isdigit():
            unresolved.append(failure)
            continue
        row = db.one(
            "SELECT id FROM users WHERE redmine_user_id=%s AND external_member_id IS NOT NULL LIMIT 1",
            (int(redmine_id),),
        )
        if not row:
            unresolved.append(failure)
    return unresolved


def load_manager_identities(config):
    path = Path(config.directory_manager_config)
    if not path.exists():
        return set()
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return set()
    values = payload.get("managers") if isinstance(payload, dict) else payload
    if not isinstance(values, list):
        return set()
    return {str(value).strip().lower() for value in values if str(value).strip()}


def fetch_directory_payload(redmine, api_key, config):
    directory_key = config.directory_api_key or api_key
    teams = []
    members = {}
    offset = 0
    limit = 100
    while True:
        params = {"limit": limit, "offset": offset}
        if directory_key:
            params["api_key"] = directory_key
        payload = redmine.request(config.directory_payload_path, params=params)
        data = payload.get("data") or {}
        for team in data.get("teams") or []:
            teams.append(team)
        for member in data.get("members") or []:
            member_id = str(member.get("id") or "").strip()
            if member_id:
                members[member_id] = member
        pagination = payload.get("pagination") or {}
        total = int(pagination.get("totalTeams") or pagination.get("total") or len(teams))
        offset += limit
        if offset >= total or not data.get("teams"):
            break
    return {"teams": teams, "members": list(members.values())}


def split_display_name(name):
    parts = str(name or "").strip().split()
    if not parts:
        return "Directory", "User"
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


def deterministic_team_color(team_id):
    colors = ["#2563eb", "#0891b2", "#059669", "#ca8a04", "#dc2626", "#7c3aed", "#db2777", "#475569"]
    total = sum(ord(char) for char in str(team_id or ""))
    return colors[total % len(colors)]


def sync_directory_payload(db, payload, config):
    manager_identities = load_manager_identities(config)
    raw_members = payload.get("members") or []
    raw_teams = payload.get("teams") or []
    if not raw_teams:
        raise ValueError("Directory payload did not contain any teams; cached teams were left unchanged.")
    member_by_external = {str(member.get("id") or "").strip(): member for member in raw_members if member.get("id")}
    lead_member_ids = {
        str(member_id).strip()
        for team in raw_teams
        for member_id in (team.get("leadMemberIds") or [])
        if str(member_id).strip()
    }
    active_member_ids = set(member_by_external)
    active_team_ids = {str(team.get("id") or "").strip() for team in raw_teams if team.get("id")}
    warnings = []

    with db.transaction() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT id,name FROM teams
                WHERE is_active=1 AND id<>%s
                  AND id NOT IN (%s)
                """ % ("%s", ",".join(["%s"] * len(active_team_ids))),
                tuple([DEFAULT_TEAM_ID, *active_team_ids]),
            )
            removed_teams = cursor.fetchall()
            if removed_teams:
                ensure_default_team(cursor)
                removed_ids = [row["id"] for row in removed_teams]
                placeholders = ",".join(["%s"] * len(removed_ids))
                cursor.execute(
                    f"UPDATE tasks SET team_id=%s WHERE team_id IN ({placeholders})",
                    tuple([DEFAULT_TEAM_ID, *removed_ids]),
                )
                warnings.append({
                    "type": "teams_removed",
                    "severity": "warning",
                    "title": "Teams removed from directory",
                    "message": f"{len(removed_ids)} team(s) disappeared from the organization directory. Their tasks were moved to Default team.",
                    "items": [f"{row['name']} ({row['id']})" for row in removed_teams],
                })

            cursor.execute("UPDATE team_members SET role='member'")
            preserve_ids = set(active_team_ids)
            cursor.execute("SELECT COUNT(*) AS count FROM tasks WHERE team_id=%s AND deleted_at IS NULL", (DEFAULT_TEAM_ID,))
            if int((cursor.fetchone() or {}).get("count") or 0):
                preserve_ids.add(DEFAULT_TEAM_ID)
            cursor.execute(
                "UPDATE teams SET is_active=0, lead_user_id=NULL WHERE id NOT IN (%s)" % ",".join(["%s"] * len(preserve_ids)),
                tuple(preserve_ids),
            )
            cursor.execute("DELETE tm FROM team_members tm LEFT JOIN teams t ON t.id=tm.team_id WHERE t.id IS NULL OR t.is_active=0")
            cursor.execute("UPDATE projects p LEFT JOIN teams t ON t.id=p.owner_team_id AND t.is_active=1 SET p.owner_team_id=NULL WHERE p.owner_team_id IS NOT NULL AND t.id IS NULL")
            cursor.execute(
                """
                SELECT COUNT(*) AS count
                FROM tasks task LEFT JOIN teams team ON team.id=task.team_id AND team.is_active=1
                WHERE task.deleted_at IS NULL AND team.id IS NULL
                """
            )
            orphan_count = int((cursor.fetchone() or {}).get("count") or 0)
            if orphan_count:
                ensure_default_team(cursor)
                cursor.execute(
                    """
                    UPDATE tasks task LEFT JOIN teams team ON team.id=task.team_id AND team.is_active=1
                    SET task.team_id=%s
                    WHERE task.deleted_at IS NULL AND team.id IS NULL
                    """,
                    (DEFAULT_TEAM_ID,),
                )
                warnings.append({
                    "type": "orphan_tasks_moved",
                    "severity": "warning",
                    "title": "Tasks moved to Default team",
                    "message": f"{orphan_count} task(s) referenced inactive or missing teams and were moved to Default team.",
                    "items": [],
                })
            cursor.execute("UPDATE users SET role='member'")
            cursor.execute("UPDATE users SET is_active=0 WHERE external_member_id IS NOT NULL")

            for member_id, member in member_by_external.items():
                email = str(member.get("email") or "").strip().lower() or None
                name = str(member.get("name") or "").strip()
                first, last = split_display_name(name)
                status = str(member.get("status") or "ACTIVE").upper()
                identity_values = {member_id.lower()}
                if email:
                    identity_values.add(email)
                    identity_values.add(email.split("@", 1)[0])
                role = "manager" if manager_identities.intersection(identity_values) else ("lead" if member_id in lead_member_ids else "member")
                cursor.execute(
                    """
                    INSERT INTO users (external_member_id, first_name, last_name, email, username, role, avatar_color, is_active, directory_synced_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,UTC_TIMESTAMP())
                    ON DUPLICATE KEY UPDATE
                      external_member_id=VALUES(external_member_id),
                      first_name=VALUES(first_name),
                      last_name=VALUES(last_name),
                      email=VALUES(email),
                      role=VALUES(role),
                      avatar_color=COALESCE(avatar_color, VALUES(avatar_color)),
                      is_active=VALUES(is_active),
                      directory_synced_at=UTC_TIMESTAMP()
                    """,
                    (member_id, first, last, email, email.split("@", 1)[0] if email else None, role, avatar_class(int(re.sub(r"\D", "", member_id) or 0)), 1 if status == "ACTIVE" else 0),
                )

            for team in raw_teams:
                team_id = str(team.get("id") or "").strip()
                if not team_id:
                    continue
                metadata = team.get("metadata") or {}
                name = str(team.get("name") or metadata.get("name") or team_id).strip()
                description = str(metadata.get("description") or "").strip()
                cursor.execute(
                    """
                    INSERT INTO teams (id, name, description, parent_team_id, color, is_active, directory_synced_at)
                    VALUES (%s,%s,%s,NULL,%s,1,UTC_TIMESTAMP())
                    ON DUPLICATE KEY UPDATE
                      name=VALUES(name),
                      description=VALUES(description),
                      color=COALESCE(color, VALUES(color)),
                      is_active=1,
                      directory_synced_at=UTC_TIMESTAMP()
                    """,
                    (team_id, name, description, deterministic_team_color(team_id)),
                )

            for team in raw_teams:
                team_id = str(team.get("id") or "").strip()
                if not team_id:
                    continue
                parent_team_id = str(team.get("parentTeamId") or "").strip() or None
                if parent_team_id == team_id or parent_team_id not in active_team_ids:
                    parent_team_id = None
                cursor.execute("UPDATE teams SET parent_team_id=%s WHERE id=%s", (parent_team_id, team_id))

            for team in raw_teams:
                team_id = str(team.get("id") or "").strip()
                if not team_id:
                    continue
                cursor.execute("DELETE FROM team_members WHERE team_id=%s", (team_id,))
                lead_ids = {str(value).strip() for value in (team.get("leadMemberIds") or [])}
                first_lead_user_id = None
                for member_id in team.get("memberIds") or []:
                    member_id = str(member_id).strip()
                    if not member_id:
                        continue
                    cursor.execute("SELECT id FROM users WHERE external_member_id=%s AND is_active=1", (member_id,))
                    user = cursor.fetchone()
                    if not user:
                        continue
                    membership_role = "lead" if member_id in lead_ids else "member"
                    if membership_role == "lead" and not first_lead_user_id:
                        first_lead_user_id = user["id"]
                    cursor.execute(
                        "INSERT INTO team_members (team_id, user_id, role) VALUES (%s,%s,%s) ON DUPLICATE KEY UPDATE role=VALUES(role)",
                        (team_id, user["id"], membership_role),
                    )
                cursor.execute("UPDATE teams SET lead_user_id=%s WHERE id=%s", (first_lead_user_id, team_id))
                if not first_lead_user_id and team.get("memberIds"):
                    warnings.append({
                        "type": "team_without_lead",
                        "severity": "info",
                        "title": "Team has no active lead",
                        "message": f"{team_id} has members but no active lead in the directory payload.",
                        "items": [name],
                    })

            if manager_identities:
                placeholders = ",".join(["%s"] * len(manager_identities))
                args = tuple(manager_identities)
                cursor.execute(
                    f"""
                    UPDATE users
                    SET role='manager', is_active=1
                    WHERE LOWER(COALESCE(email, '')) IN ({placeholders})
                       OR LOWER(COALESCE(username, '')) IN ({placeholders})
                       OR LOWER(COALESCE(external_member_id, '')) IN ({placeholders})
                    """,
                    args + args + args,
                )

    health = directory_health(db)
    return {"teams": len(active_team_ids), "members": len(active_member_ids), "warnings": [*warnings, *health["warnings"]]}


def sync_team_directory(db, redmine, api_key, config):
    payload = fetch_directory_payload(redmine, api_key, config)
    result = sync_directory_payload(db, payload, config)
    redmine_result = sync_redmine_users(db, redmine, api_key)
    result["redmineUsersSynced"] = redmine_result.get("synced", 0)
    result["redmineUsersLinked"] = redmine_result.get("linked", 0)
    if redmine_result.get("failed"):
        result.setdefault("warnings", []).append({
            "type": "redmine_user_link_failed",
            "severity": "warning",
            "title": "Redmine user linking incomplete",
            "message": "The directory was synced, but one or more Redmine users could not be processed. Some team members may not show assigned issues until their Redmine IDs are linked.",
            "items": redmine_result.get("failures") or [],
        })
    return result


def directory_last_synced_at(db):
    row = db.one(
        """
        SELECT MAX(synced_at) AS last_synced_at
        FROM (
          SELECT MAX(directory_synced_at) AS synced_at FROM users WHERE directory_synced_at IS NOT NULL
          UNION ALL
          SELECT MAX(directory_synced_at) AS synced_at FROM teams WHERE directory_synced_at IS NOT NULL
        ) directory_syncs
        """
    )
    return (row or {}).get("last_synced_at")


def is_directory_sync_fresh(db, max_age_hours=24):
    active_team_count = db.one("SELECT COUNT(*) AS count FROM teams WHERE is_active=1")
    if int((active_team_count or {}).get("count") or 0) == 0:
        return False
    last_synced_at = directory_last_synced_at(db)
    if not last_synced_at:
        return False
    return last_synced_at >= now_utc() - timedelta(hours=max_age_hours)


def sync_team_directory_if_stale(db, redmine, api_key, config, max_age_hours=24):
    last_synced_at = directory_last_synced_at(db)
    if is_directory_sync_fresh(db, max_age_hours):
        health = directory_health(db)
        return {
            "skipped": True,
            "reason": "fresh",
            "lastSyncedAt": last_synced_at.isoformat() if last_synced_at else None,
            "warnings": health["warnings"],
        }
    result = sync_team_directory(db, redmine, api_key, config)
    result["skipped"] = False
    result["lastSyncedAt"] = directory_last_synced_at(db).isoformat() if directory_last_synced_at(db) else None
    return result


def ensure_default_team(cursor):
    cursor.execute(
        """
        INSERT INTO teams (id, name, description, parent_team_id, color, is_active)
        VALUES (%s, %s, 'Tasks moved here because their source team disappeared from the organization directory.', NULL, '#dc2626', 1)
        ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), parent_team_id=NULL, is_active=1
        """,
        (DEFAULT_TEAM_ID, DEFAULT_TEAM_NAME),
    )


def directory_health(db):
    warnings = []
    default_summary = db.one(
        """
        SELECT COUNT(*) AS count
        FROM tasks
        WHERE team_id=%s AND deleted_at IS NULL
        """,
        (DEFAULT_TEAM_ID,),
    )
    default_count = int((default_summary or {}).get("count") or 0)
    if default_count:
        warnings.append({
            "type": "default_team_tasks",
            "severity": "warning",
            "title": "Default team needs review",
            "message": f"{default_count} active task(s) are in Default team because their original team could not be matched.",
            "items": [],
        })

    orphan_summary = db.one(
        """
        SELECT COUNT(*) AS count
        FROM tasks task LEFT JOIN teams team ON team.id=task.team_id AND team.is_active=1
        WHERE task.deleted_at IS NULL AND team.id IS NULL
        """
    )
    orphan_count = int((orphan_summary or {}).get("count") or 0)
    if orphan_count:
        warnings.append({
            "type": "orphan_tasks",
            "severity": "error",
            "title": "Tasks reference inactive teams",
            "message": f"{orphan_count} active task(s) still reference inactive or missing teams.",
            "items": [],
        })

    inactive_assignee_summary = db.one(
        """
        SELECT COUNT(DISTINCT ta.user_id) AS count
        FROM task_assignments ta JOIN users u ON u.id=ta.user_id JOIN tasks t ON t.id=ta.task_id
        WHERE u.is_active=0 AND t.deleted_at IS NULL
        """
    )
    inactive_assignee_count = int((inactive_assignee_summary or {}).get("count") or 0)
    if inactive_assignee_count:
        warnings.append({
            "type": "inactive_assignees",
            "severity": "info",
            "title": "Inactive assignees remain on tasks",
            "message": f"{inactive_assignee_count} inactive user(s) are still assigned to active tasks.",
            "items": [],
        })

    no_lead_rows = db.query(
        """
        SELECT t.id,t.name FROM teams t
        WHERE t.is_active=1 AND t.id<>%s AND t.parent_team_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM team_members tm JOIN users u ON u.id=tm.user_id AND u.is_active=1
            WHERE tm.team_id=t.id AND tm.role='lead'
          )
        ORDER BY name
        """,
        (DEFAULT_TEAM_ID,),
    )
    if no_lead_rows:
        warnings.append({
            "type": "teams_without_leads",
            "severity": "info",
            "title": "Teams without active leads",
            "message": f"{len(no_lead_rows)} active team(s) have no active lead.",
            "items": [f"{row['name']} ({row['id']})" for row in no_lead_rows[:12]],
        })

    return {"warnings": warnings}


def create_session(db, user_id, api_key, config, user_agent="", ip_address=""):
    token = str(uuid.uuid4())
    session_id = str(uuid.uuid4())
    expires = now_utc() + timedelta(hours=config.session_hours)
    db.execute(
        """
        INSERT INTO user_sessions (id, user_id, token_hash, redmine_api_key, expires_at, user_agent, ip_address)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
        """,
        (session_id, user_id, hash_token(token), api_key, expires, user_agent[:255], ip_address[:45]),
    )
    return token


def authenticate_cookie(db, cookie_header):
    token = read_cookie(cookie_header, "session_id")
    if not token:
        return None
    row = db.one(
        """
        SELECT s.*, u.*, s.id AS session_row_id
        FROM user_sessions s JOIN users u ON u.id=s.user_id
        WHERE s.token_hash=%s AND s.expires_at > UTC_TIMESTAMP() AND u.is_active=1
        """,
        (hash_token(token),),
    )
    if row:
        db.execute("UPDATE user_sessions SET last_used_at=UTC_TIMESTAMP() WHERE id=%s", (row["session_row_id"],))
    return row


def read_cookie(cookie_header, name):
    for part in str(cookie_header or "").split(";"):
        if "=" not in part:
            continue
        key, value = part.strip().split("=", 1)
        if key == name:
            return value
    return ""


def logout(db, cookie_header):
    token = read_cookie(cookie_header, "session_id")
    if token:
        db.execute("DELETE FROM user_sessions WHERE token_hash=%s", (hash_token(token),))


def primary_team_for_user(db, user_id):
    rows = teams_for_user(db, user_id)
    return rows[0] if rows else None


def teams_for_user(db, user_id):
    rows = db.query(
        """
        SELECT t.id, t.name, tm.role AS membership_role
        FROM teams t
        JOIN team_members tm ON tm.team_id=t.id AND tm.user_id=%s
        JOIN users u ON u.id=tm.user_id AND u.is_active=1
        WHERE t.is_active=1
        ORDER BY (tm.role='lead') DESC, t.name
        """,
        (user_id,),
    )
    return [row["id"] for row in rows]


def ensure_planner_schema(db):
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS user_preferences (
          user_id BIGINT UNSIGNED NOT NULL,
          hide_done_tasks TINYINT(1) NOT NULL DEFAULT 0,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id),
          CONSTRAINT fk_user_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS task_audit_log (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          task_id BIGINT UNSIGNED NOT NULL,
          user_id BIGINT UNSIGNED NULL,
          action VARCHAR(32) NOT NULL,
          diff JSON NULL,
          occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_audit_task (task_id),
          KEY idx_audit_time (occurred_at),
          CONSTRAINT fk_audit_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
          CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    db.execute(
        """
        INSERT INTO statuses (id, label, is_terminal, sort_order, color_class) VALUES
          ('new', 'New', 0, 5, 'pill-new'),
          ('working', 'In progress', 0, 10, 'pill-working'),
          ('blocked', 'Blocked', 0, 20, 'pill-blocked'),
          ('onhold', 'On hold', 0, 30, 'pill-onhold'),
          ('done', 'Done', 1, 40, 'pill-done')
        ON DUPLICATE KEY UPDATE label=VALUES(label), is_terminal=VALUES(is_terminal), sort_order=VALUES(sort_order), color_class=VALUES(color_class)
        """
    )
    db.execute("ALTER TABLE tasks MODIFY status_id VARCHAR(16) NOT NULL DEFAULT 'new'")

    user_columns = {
        row["COLUMN_NAME"]
        for row in db.query(
            """
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users'
            """
        )
    }
    if "external_member_id" not in user_columns:
        db.execute("ALTER TABLE users ADD COLUMN external_member_id VARCHAR(64) NULL AFTER redmine_user_id")
        db.execute("ALTER TABLE users ADD UNIQUE KEY uq_users_external_member (external_member_id)")
    if "directory_synced_at" not in user_columns:
        db.execute("ALTER TABLE users ADD COLUMN directory_synced_at DATETIME NULL AFTER last_login_at")

    columns = {
        row["COLUMN_NAME"]
        for row in db.query(
            """
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='teams'
            """
        )
    }
    if "parent_team_id" not in columns:
        db.execute("ALTER TABLE teams ADD COLUMN parent_team_id VARCHAR(32) NULL AFTER description")
        db.execute("ALTER TABLE teams ADD KEY idx_teams_parent (parent_team_id)")
        db.execute("ALTER TABLE teams ADD CONSTRAINT fk_teams_parent FOREIGN KEY (parent_team_id) REFERENCES teams(id) ON DELETE SET NULL")
    if "color" not in columns:
        db.execute("ALTER TABLE teams ADD COLUMN color VARCHAR(16) NULL AFTER lead_user_id")
    if "directory_synced_at" not in columns:
        db.execute("ALTER TABLE teams ADD COLUMN directory_synced_at DATETIME NULL AFTER is_active")
    member_columns = {
        row["COLUMN_NAME"]
        for row in db.query(
            """
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='team_members'
            """
        )
    }
    if "role" not in member_columns:
        db.execute("ALTER TABLE team_members ADD COLUMN role ENUM('member','lead') NOT NULL DEFAULT 'member' AFTER user_id")
    task_project = db.one(
        """
        SELECT IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tasks' AND COLUMN_NAME='project_id'
        """
    )
    if task_project and task_project.get("IS_NULLABLE") == "NO":
        db.execute("ALTER TABLE tasks MODIFY project_id BIGINT UNSIGNED NULL")
    task_columns = {
        row["COLUMN_NAME"]
        for row in db.query(
            """
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tasks'
            """
        )
    }
    if "parent_task_id" not in task_columns:
        db.execute("ALTER TABLE tasks ADD COLUMN parent_task_id BIGINT UNSIGNED NULL AFTER project_id")
        db.execute("ALTER TABLE tasks ADD KEY idx_tasks_parent (parent_task_id)")
        db.execute("ALTER TABLE tasks ADD CONSTRAINT fk_tasks_parent FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE SET NULL")

    db.execute("UPDATE teams SET color=COALESCE(color, '#818cf8')")


def migrate_team_config(db):
    path = ROOT / "team-config.local.json"
    if not path.exists():
        return
    if db.one("SELECT COUNT(*) AS count FROM team_members")["count"]:
        return
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return
    for team in payload.get("teams", []):
        team_id = str(team.get("id") or "").strip()
        name = str(team.get("name") or team_id).strip()
        if not team_id or not name:
            continue
        parent_team_id = str(team.get("parentTeamId") or "").strip() or None
        db.execute(
            """
            INSERT INTO teams (id,name,parent_team_id)
            VALUES (%s,%s,%s)
            ON DUPLICATE KEY UPDATE name=VALUES(name), parent_team_id=VALUES(parent_team_id)
            """,
            (team_id, name, parent_team_id),
        )
        for redmine_id in team.get("memberIds", []):
            if not str(redmine_id).isdigit():
                continue
            rid = int(redmine_id)
            db.execute(
                """
                INSERT INTO users (redmine_user_id, first_name, last_name, avatar_color)
                VALUES (%s,%s,%s,%s)
                ON DUPLICATE KEY UPDATE redmine_user_id=VALUES(redmine_user_id)
                """,
                (rid, "Redmine", f"User {rid}", avatar_class(rid)),
            )
            user = db.one("SELECT id FROM users WHERE redmine_user_id=%s", (rid,))
            if user:
                db.execute(
                    "INSERT IGNORE INTO team_members (team_id,user_id) VALUES (%s,%s)",
                    (team_id, user["id"]),
                )


def list_lookups(db):
    return {
        "categories": db.query("SELECT id,label,color_class AS colorClass,sort_order AS sortOrder FROM categories ORDER BY sort_order"),
        "priorities": db.query("SELECT id,label,color_class AS colorClass,sort_order AS sortOrder FROM priorities ORDER BY sort_order"),
        "statuses": db.query("SELECT id,label,color_class AS colorClass,is_terminal AS isTerminal FROM statuses ORDER BY sort_order"),
    }


def user_preferences(db, user_id):
    row = db.one("SELECT hide_done_tasks FROM user_preferences WHERE user_id=%s", (user_id,))
    return {
        "hideDoneTasks": bool(row.get("hide_done_tasks")) if row else False,
    }


def save_user_preferences(db, user_id, payload):
    hide_done = 1 if payload.get("hideDoneTasks") else 0
    db.execute(
        """
        INSERT INTO user_preferences (user_id, hide_done_tasks)
        VALUES (%s,%s)
        ON DUPLICATE KEY UPDATE hide_done_tasks=VALUES(hide_done_tasks)
        """,
        (user_id, hide_done),
    )
    return user_preferences(db, user_id)


def list_teams(db, restrict_to=None):
    extra = ""
    args = []
    if restrict_to is not None:
        if not restrict_to:
            return []
        placeholders = ",".join(["%s"] * len(restrict_to))
        extra = f" AND t.id IN ({placeholders})"
        args = list(restrict_to)
    teams = db.query(
        f"""
        SELECT t.id, t.name, t.description, t.parent_team_id, t.color, t.lead_user_id, t.updated_at,
               COUNT(DISTINCT tm.user_id) AS memberCount,
               COUNT(DISTINCT p.id) AS projectCount
        FROM teams t
        LEFT JOIN team_members tm ON tm.team_id=t.id
        LEFT JOIN projects p ON p.owner_team_id=t.id AND p.is_active=1
        WHERE t.is_active=1{extra}
        GROUP BY t.id, t.name, t.description, t.parent_team_id, t.color, t.lead_user_id, t.updated_at
        ORDER BY (t.parent_team_id IS NULL) DESC, t.name
        """,
        args,
    )
    leads_by_team = lead_users_by_team(db, [team["id"] for team in teams])
    result = []
    for t in teams:
        lead_users = leads_by_team.get(t["id"], [])
        result.append({
            "id": t["id"],
            "name": t["name"],
            "description": t.get("description") or "",
            "parentTeamId": t.get("parent_team_id") or "",
            "isRoot": not bool(t.get("parent_team_id")),
            "color": t.get("color") or "#818cf8",
            "memberCount": t["memberCount"],
            "projectCount": t["projectCount"],
            "updatedAt": date_value(t.get("updated_at")),
            "leadUser": lead_users[0] if lead_users else None,
            "leadUsers": lead_users,
        })
    return result


def lead_users_by_team(db, team_ids):
    if not team_ids:
        return {}
    placeholders = ",".join(["%s"] * len(team_ids))
    rows = db.query(
        f"""
        SELECT tm.team_id, u.*
        FROM team_members tm JOIN users u ON u.id=tm.user_id
        WHERE tm.team_id IN ({placeholders}) AND tm.role='lead' AND u.is_active=1
        ORDER BY tm.team_id, u.first_name, u.last_name
        """,
        list(team_ids),
    )
    result = {team_id: [] for team_id in team_ids}
    for row in rows:
        result.setdefault(row["team_id"], []).append(user_summary(row))
    return result


def team_config_payload(db, restrict_to=None):
    payload = []
    extra = ""
    args = []
    if restrict_to is not None:
        if not restrict_to:
            return {"teams": []}
        placeholders = ",".join(["%s"] * len(restrict_to))
        extra = f" AND id IN ({placeholders})"
        args = list(restrict_to)
    for team in db.query(f"SELECT id,name,parent_team_id FROM teams WHERE is_active=1{extra} ORDER BY name", args):
        members = db.query(
            """
            SELECT u.redmine_user_id
            FROM users u JOIN team_members tm ON tm.user_id=u.id
            WHERE tm.team_id=%s AND u.is_active=1 AND u.redmine_user_id IS NOT NULL
            ORDER BY u.first_name,u.last_name
            """,
            (team["id"],),
        )
        payload.append({
            "id": team["id"],
            "name": team["name"],
            "parentTeamId": team.get("parent_team_id") or "",
            "memberIds": [member["redmine_user_id"] for member in members],
        })
    return {"teams": payload}


def save_team_config_payload(db, payload):
    teams = payload.get("teams")
    if not isinstance(teams, list):
        raise ValueError("Team config must contain a teams array.")

    with db.transaction() as conn:
        with conn.cursor() as cursor:
            seen = set()
            for team in teams:
                team_id = str(team.get("id") or "").strip()
                name = str(team.get("name") or "").strip()
                if not team_id or not name or team_id in seen:
                    raise ValueError("Each team needs a unique id and name.")
                seen.add(team_id)
                parent_team_id = str(team.get("parentTeamId") or "").strip() or None
                if parent_team_id == team_id:
                    parent_team_id = None
                cursor.execute(
                    """
                    INSERT INTO teams (id,name,parent_team_id,is_active)
                    VALUES (%s,%s,%s,1)
                    ON DUPLICATE KEY UPDATE name=VALUES(name), parent_team_id=VALUES(parent_team_id), is_active=1
                    """,
                    (team_id, name, parent_team_id),
                )
                cursor.execute("DELETE FROM team_members WHERE team_id=%s", (team_id,))
                for redmine_id in team.get("memberIds") or []:
                    if not str(redmine_id).isdigit():
                        continue
                    redmine_id = int(redmine_id)
                    cursor.execute("SELECT id FROM users WHERE redmine_user_id=%s", (redmine_id,))
                    user = cursor.fetchone()
                    if user:
                        user_id = user["id"]
                    else:
                        cursor.execute(
                            """
                            INSERT INTO users (redmine_user_id, first_name, last_name, avatar_color)
                            VALUES (%s,%s,%s,%s)
                            """,
                            (redmine_id, "Redmine", f"User {redmine_id}", avatar_class(redmine_id)),
                        )
                        user_id = cursor.lastrowid
                    cursor.execute(
                        "INSERT IGNORE INTO team_members (team_id,user_id) VALUES (%s,%s)",
                        (team_id, user_id),
                    )

    return team_config_payload(db)


def get_team(db, team_id):
    team = db.one("SELECT * FROM teams WHERE id=%s AND is_active=1", (team_id,))
    if not team:
        return None
    members = db.query(
        """
        SELECT u.*, tm.role AS membership_role FROM users u JOIN team_members tm ON tm.user_id=u.id
        WHERE tm.team_id=%s AND u.is_active=1
        ORDER BY tm.role='lead' DESC, u.first_name,u.last_name
        """,
        (team_id,),
    )
    projects = db.query(
        "SELECT id, name FROM projects WHERE owner_team_id=%s AND is_active=1 ORDER BY name",
        (team_id,),
    )
    lead_users = lead_users_by_team(db, [team_id]).get(team_id, [])
    lead_user = lead_users[0] if lead_users else None
    member_list = []
    for m in members:
        display = m.get("display_name") or f"{m.get('first_name', '')} {m.get('last_name', '')}".strip()
        is_lead = m.get("membership_role") == "lead"
        member_list.append({
            "id": m["id"],
            "name": display,
            "email": m.get("email") or "",
            "avatarColor": m.get("avatar_color") or avatar_class(m["id"]),
            "avatarUrl": m.get("avatar_url") or "",
            "initials": initials(display),
            "role": m.get("role") or "member",
            "membershipRole": m.get("membership_role") or "member",
            "position": "Lead" if is_lead else "Member",
        })
    project_list = []
    for p in projects:
        badge = "".join(part[0] for part in str(p["name"]).split()[:2]).upper() or "P"
        project_list.append({"id": p["id"], "name": p["name"], "badge": badge})
    return {
        "id": team["id"],
        "name": team["name"],
        "description": team.get("description") or "",
        "parentTeamId": team.get("parent_team_id") or "",
        "isRoot": not bool(team.get("parent_team_id")),
        "color": team.get("color") or "#818cf8",
        "updatedAt": date_value(team.get("updated_at")),
        "leadUser": lead_user,
        "leadUsers": lead_users,
        "members": member_list,
        "projects": project_list,
    }


def _slugify_team_id(name, max_len=10):
    import re as _re
    slug = _re.sub(r"[^a-z0-9]+", "-", str(name).strip().lower()).strip("-")
    return (slug or "team")[:max_len]


def create_team(db, data):
    name = str(data.get("name") or "").strip()
    if not name:
        raise ValueError("Team name is required.")
    team_id = str(data.get("id") or data.get("shortCode") or "").strip()
    if not team_id:
        team_id = _slugify_team_id(name)
    # ensure unique
    base = team_id
    idx = 2
    while db.one("SELECT id FROM teams WHERE id=%s", (team_id,)):
        team_id = f"{base}-{idx}"
        idx += 1
    description = str(data.get("description") or "").strip()
    color = str(data.get("color") or "#818cf8").strip()
    parent_team_id = str(data.get("parentTeamId") or "").strip() or None
    if parent_team_id == team_id:
        parent_team_id = None
    db.execute(
        "INSERT INTO teams (id, name, description, parent_team_id, color) VALUES (%s,%s,%s,%s,%s)",
        (team_id, name, description, parent_team_id, color),
    )
    # set members
    for uid in data.get("memberIds") or []:
        db.execute("INSERT IGNORE INTO team_members (team_id, user_id) VALUES (%s,%s)", (team_id, int(uid)))
    # set lead
    lead_uid = data.get("leadUserId")
    if lead_uid:
        db.execute(
            "INSERT INTO team_members (team_id, user_id, role) VALUES (%s,%s,'lead') ON DUPLICATE KEY UPDATE role='lead'",
            (team_id, int(lead_uid)),
        )
        db.execute("UPDATE teams SET lead_user_id=%s WHERE id=%s", (int(lead_uid), team_id))
    # set projects
    project_ids = data.get("projectIds") or []
    if project_ids:
        placeholders = ",".join(["%s"] * len(project_ids))
        db.execute(
            f"UPDATE projects SET owner_team_id=%s WHERE id IN ({placeholders}) AND is_active=1",
            [team_id] + list(project_ids),
        )
    return get_team(db, team_id)


def update_team(db, team_id, data):
    team = db.one("SELECT * FROM teams WHERE id=%s AND is_active=1", (team_id,))
    if not team:
        raise KeyError("Team not found.")
    fields = []
    args = []
    if "name" in data:
        fields.append("name=%s")
        args.append(str(data["name"]).strip())
    if "description" in data:
        fields.append("description=%s")
        args.append(str(data["description"]).strip())
    if "parentTeamId" in data:
        parent_team_id = str(data.get("parentTeamId") or "").strip() or None
        if parent_team_id == team_id:
            parent_team_id = None
        fields.append("parent_team_id=%s")
        args.append(parent_team_id)
    if "color" in data:
        fields.append("color=%s")
        args.append(str(data["color"]).strip())
    if fields:
        args.append(team_id)
        db.execute(f"UPDATE teams SET {', '.join(fields)} WHERE id=%s", args)
    return get_team(db, team_id)


def delete_team(db, team_id):
    db.execute("UPDATE teams SET is_active=0 WHERE id=%s", (team_id,))


def add_team_member(db, team_id, user_id):
    db.execute("INSERT IGNORE INTO team_members (team_id, user_id) VALUES (%s,%s)", (team_id, int(user_id)))
    return get_team(db, team_id)


def remove_team_member(db, team_id, user_id):
    user_id = int(user_id)
    db.execute("DELETE FROM team_members WHERE team_id=%s AND user_id=%s", (team_id, user_id))
    team = db.one("SELECT * FROM teams WHERE id=%s", (team_id,))
    if team and team.get("lead_user_id") == user_id:
        db.execute("UPDATE teams SET lead_user_id=NULL WHERE id=%s", (team_id,))
    return get_team(db, team_id)


def set_team_lead(db, team_id, user_id):
    user_id = int(user_id)
    db.execute(
        "INSERT INTO team_members (team_id, user_id, role) VALUES (%s,%s,'lead') ON DUPLICATE KEY UPDATE role='lead'",
        (team_id, user_id),
    )
    db.execute("UPDATE teams SET lead_user_id=%s WHERE id=%s", (user_id, team_id))
    return get_team(db, team_id)


def set_team_projects(db, team_id, project_ids):
    if project_ids:
        placeholders = ",".join(["%s"] * len(project_ids))
        db.execute(
            f"UPDATE projects SET owner_team_id=%s WHERE id IN ({placeholders}) AND is_active=1",
            [team_id] + list(project_ids),
        )
        db.execute(
            f"UPDATE projects SET owner_team_id=NULL WHERE owner_team_id=%s AND id NOT IN ({placeholders}) AND is_active=1",
            [team_id] + list(project_ids),
        )
    else:
        db.execute("UPDATE projects SET owner_team_id=NULL WHERE owner_team_id=%s AND is_active=1", (team_id,))
    return get_team(db, team_id)


def list_users(db, restrict_to_teams=None):
    extra = ""
    args = []
    if restrict_to_teams is not None:
        if not restrict_to_teams:
            return []
        placeholders = ",".join(["%s"] * len(restrict_to_teams))
        extra = f" AND EXISTS (SELECT 1 FROM team_members visible_tm WHERE visible_tm.user_id=u.id AND visible_tm.team_id IN ({placeholders}))"
        args = list(restrict_to_teams)
    rows = db.query(
        f"""
        SELECT u.*, GROUP_CONCAT(tm.team_id ORDER BY tm.team_id) AS team_ids
        FROM users u LEFT JOIN team_members tm ON tm.user_id=u.id
        WHERE u.is_active=1 AND u.external_member_id IS NOT NULL{extra}
        GROUP BY u.id
        ORDER BY u.first_name,u.last_name
        """,
        args,
    )
    users = []
    for row in rows:
        team_ids = [value for value in str(row.get("team_ids") or "").split(",") if value]
        users.append(member_payload(row, team_ids[0] if team_ids else None, team_ids))
    return users


def redmine_user_ids_for_teams(db, team_ids):
    if not team_ids:
        return []
    placeholders = ",".join(["%s"] * len(team_ids))
    rows = db.query(
        f"""
        SELECT DISTINCT u.redmine_user_id
        FROM users u JOIN team_members tm ON tm.user_id=u.id
        WHERE tm.team_id IN ({placeholders})
          AND u.is_active=1
          AND u.redmine_user_id IS NOT NULL
        """,
        list(team_ids),
    )
    return [int(row["redmine_user_id"]) for row in rows]


def user_can_access_project(db, user, project_id):
    if user["role"] in ("manager", "admin"):
        return True
    if not project_id:
        return True
    project = db.one("SELECT owner_team_id FROM projects WHERE id=%s AND is_active=1", (project_id,))
    if not project:
        return False
    owner_team_id = project.get("owner_team_id")
    return not owner_team_id or owner_team_id in teams_for_user(db, user["id"])


def member_payload(user, team_id=None, team_ids=None):
    display = user.get("display_name") or f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
    return {
        "id": user["id"],
        "redmineUserId": user.get("redmine_user_id"),
        "externalMemberId": user.get("external_member_id") or "",
        "name": display,
        "email": user.get("email") or "",
        "username": user.get("username") or "",
        "role": user.get("role") or "member",
        "teamId": team_id,
        "teamIds": team_ids or ([team_id] if team_id else []),
        "avatarUrl": user.get("avatar_url") or "",
        "avatarColor": user.get("avatar_color") or avatar_class(user["id"]),
        "initials": initials(display),
    }


def list_projects(db, restrict_to_teams=None):
    extra = ""
    args = []
    if restrict_to_teams is not None:
        if not restrict_to_teams:
            return []
        placeholders = ",".join(["%s"] * len(restrict_to_teams))
        extra = f" AND (owner_team_id IN ({placeholders}) OR owner_team_id IS NULL)"
        args = list(restrict_to_teams)
    return db.query(
        f"""
        SELECT id,name,source,redmine_identifier AS redmineIdentifier,owner_team_id AS ownerTeamId
        FROM projects WHERE is_active=1{extra} ORDER BY source DESC,name
        """,
        args,
    )


def list_redmine_projects(db, redmine, api_key, query="", restrict_to_teams=None):
    projects = []
    offset = 0
    limit = 100
    while True:
        payload = redmine.get("/projects.json", api_key, {"limit": limit, "offset": offset})
        batch = payload.get("projects", [])
        for raw in batch:
            ensure_project(db, raw)
        projects.extend(batch)
        total = int(payload.get("total_count") or len(projects))
        offset += limit
        if offset >= total or not batch or offset >= 500:
            break

    rows = [row for row in list_projects(db, restrict_to_teams=restrict_to_teams) if row.get("source") == "redmine"]
    needle = str(query or "").strip().lower()
    if needle:
        rows = [
            row for row in rows
            if needle in str(row.get("name") or "").lower()
            or needle in str(row.get("redmineIdentifier") or "").lower()
        ]
    return rows


def parse_issue_id(value):
    text = str(value or "").strip()
    match = re.search(r"(?:issues/|#)?(\d+)", text)
    if match:
        return int(match.group(1))
    match = re.search(r"-(\d+)$", text)
    return int(match.group(1)) if match else None


def normalize_redmine_issue(db, issue):
    project = issue.get("project") or {}
    project_id = ensure_project(db, project)
    status_id = map_status(issue.get("status", {}).get("name"))
    priority_id = map_priority(issue.get("priority", {}).get("name"))
    redmine_issue_id = int(issue.get("id"))
    issue_key = issue.get("issue_key") or f"{project.get('identifier') or 'ISSUE'}-{redmine_issue_id}"
    db.execute(
        """
        INSERT INTO redmine_tickets
          (redmine_issue_id, issue_key, project_id, title, status_id, priority_id, progress, start_date, due_date, estimated_hours, logged_hours, last_synced_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,UTC_TIMESTAMP())
        ON DUPLICATE KEY UPDATE
          issue_key=VALUES(issue_key), project_id=VALUES(project_id), title=VALUES(title),
          status_id=VALUES(status_id), priority_id=VALUES(priority_id), progress=VALUES(progress),
          start_date=VALUES(start_date), due_date=VALUES(due_date),
          estimated_hours=VALUES(estimated_hours), logged_hours=VALUES(logged_hours), last_synced_at=UTC_TIMESTAMP()
        """,
        (
            redmine_issue_id,
            issue_key,
            project_id,
            issue.get("subject") or f"Issue {redmine_issue_id}",
            status_id,
            priority_id,
            int(issue.get("done_ratio") or 0),
            issue.get("start_date") or None,
            issue.get("due_date") or None,
            issue.get("estimated_hours"),
            issue.get("spent_hours"),
        ),
    )
    ticket = db.one("SELECT * FROM redmine_tickets WHERE redmine_issue_id=%s", (redmine_issue_id,))
    replace_ticket_assignees(db, ticket["id"], issue)
    for child in issue.get("children") or []:
        if not child.get("id"):
            continue
        child_ticket = normalize_redmine_issue(db, child)
        db.execute(
            "UPDATE redmine_tickets SET parent_ticket_id=%s WHERE id=%s",
            (ticket["id"], child_ticket["id"]),
        )
    return ticket_payload(db, ticket)


def ensure_project(db, project):
    redmine_id = project.get("id")
    raw_identifier = project.get("identifier") or project.get("name") or f"redmine-{redmine_id or uuid.uuid4()}"
    identifier = re.sub(r"[^a-z0-9]+", "-", str(raw_identifier).strip().lower()).strip("-")
    if not identifier:
        identifier = f"redmine-{redmine_id or uuid.uuid4()}"
    name = project.get("name") or identifier or "Redmine project"

    if redmine_id:
        row = db.one("SELECT id FROM projects WHERE redmine_project_id=%s", (redmine_id,))
        if row:
            db.execute("UPDATE projects SET name=%s, is_active=1 WHERE id=%s", (name, row["id"]))
            return row["id"]

    row = db.one("SELECT id FROM projects WHERE redmine_identifier=%s", (identifier,))
    if row:
        if redmine_id and not row.get("redmine_project_id"):
            db.execute(
                "UPDATE projects SET name=%s, redmine_project_id=%s, is_active=1 WHERE id=%s",
                (name, redmine_id, row["id"]),
            )
        else:
            db.execute("UPDATE projects SET name=%s, is_active=1 WHERE id=%s", (name, row["id"]))
        return row["id"]

    db.execute(
        "INSERT INTO projects (name,source,redmine_project_id,redmine_identifier) VALUES (%s,'redmine',%s,%s)",
        (name, redmine_id, identifier),
    )
    row = db.one("SELECT id FROM projects WHERE redmine_identifier=%s", (identifier,))
    if not row and redmine_id:
        row = db.one("SELECT id FROM projects WHERE redmine_project_id=%s", (redmine_id,))
    if not row:
        raise ValueError(f"Unable to cache Redmine project {name}.")
    return row["id"]


def replace_ticket_assignees(db, ticket_id, issue):
    assignee = issue.get("assigned_to") or {}
    db.execute("DELETE FROM redmine_ticket_assignees WHERE ticket_id=%s", (ticket_id,))
    if not assignee.get("id"):
        return
    user = db.one("SELECT id FROM users WHERE redmine_user_id=%s", (int(assignee["id"]),))
    if user:
        db.execute("INSERT IGNORE INTO redmine_ticket_assignees (ticket_id,user_id) VALUES (%s,%s)", (ticket_id, user["id"]))


def map_status(name):
    value = str(name or "").strip().lower()
    if value == "new":
        return "new"
    if "closed" in value or "done" in value or "staged" in value:
        return "done"
    if "hold" in value:
        return "onhold"
    if "block" in value or "reject" in value:
        return "blocked"
    return "working"


def map_priority(name):
    value = str(name or "").lower()
    if "critical" in value or "immediate" in value:
        return "critical"
    if "high" in value:
        return "high"
    if "low" in value:
        return "low"
    if "none" in value:
        return "none"
    return "medium"


def list_redmine_recent_tickets(db, redmine, api_key, project_id=None, query=""):
    params = {"status_id": "*", "sort": "created_on:desc", "limit": 10}
    if project_id:
        project = db.one("SELECT * FROM projects WHERE id=%s", (project_id,))
        if project and project.get("redmine_identifier"):
            params["project_id"] = project["redmine_identifier"]
    if query.strip():
        issue_id = parse_issue_id(query)
        if issue_id:
            issue = redmine.get(f"/issues/{issue_id}.json", api_key, {"include": "children"})
            return [normalize_redmine_issue(db, issue.get("issue") or {})]
        params["subject"] = f"~{query.strip()}"
    payload = redmine.get("/issues.json", api_key, params)
    return [normalize_redmine_issue(db, issue) for issue in payload.get("issues", [])]


def get_or_fetch_ticket(db, redmine, api_key, value):
    issue_id = parse_issue_id(value)
    if not issue_id:
        return None
    cached = db.one("SELECT * FROM redmine_tickets WHERE redmine_issue_id=%s", (issue_id,))
    if cached:
        return ticket_payload(db, cached)
    payload = redmine.get(f"/issues/{issue_id}.json", api_key, {"include": "children"})
    issue = payload.get("issue") or {}
    return normalize_redmine_issue(db, issue) if issue else None


def refresh_ticket(db, redmine, api_key, redmine_issue_id):
    payload = redmine.get(f"/issues/{int(redmine_issue_id)}.json", api_key, {"include": "children"})
    issue = payload.get("issue") or {}
    return normalize_redmine_issue(db, issue) if issue else None


def ticket_payload(db, ticket):
    project = db.one("SELECT id,name,redmine_identifier FROM projects WHERE id=%s", (ticket["project_id"],))
    assignees = db.query(
        """
        SELECT u.* FROM users u JOIN redmine_ticket_assignees rta ON rta.user_id=u.id
        WHERE rta.ticket_id=%s ORDER BY u.first_name,u.last_name
        """,
        (ticket["id"],),
    )
    return {
        "id": ticket["id"],
        "redmineIssueId": ticket["redmine_issue_id"],
        "issueKey": ticket["issue_key"],
        "title": ticket["title"],
        "projectId": ticket["project_id"],
        "projectName": project["name"] if project else "",
        "statusId": ticket.get("status_id") or "working",
        "priorityId": ticket.get("priority_id") or "medium",
        "progress": int(ticket.get("progress") or 0),
        "startDate": date_value(ticket.get("start_date")),
        "dueDate": date_value(ticket.get("due_date")),
        "estimatedHours": float(ticket["estimated_hours"]) if ticket.get("estimated_hours") is not None else None,
        "loggedHours": float(ticket["logged_hours"]) if ticket.get("logged_hours") is not None else None,
        "assigneeIds": [user["id"] for user in assignees],
    }


def ticket_subtree_assignee_ids(db, ticket_id):
    rows = db.query(
        """
        SELECT DISTINCT rta.user_id
        FROM redmine_tickets root
        JOIN redmine_tickets rt ON rt.id=root.id OR rt.parent_ticket_id=root.id
        JOIN redmine_ticket_assignees rta ON rta.ticket_id=rt.id
        WHERE root.id=%s
        ORDER BY rta.user_id
        """,
        (ticket_id,),
    )
    return [row["user_id"] for row in rows]


def date_value(value):
    return value.isoformat() if hasattr(value, "isoformat") else (value or "")


def list_tasks(db, user, filters):
    where = ["t.deleted_at IS NULL"]
    args = []
    preferences = user_preferences(db, user["id"])
    hide_done = truthy(filters.get("hide_done")) if "hide_done" in filters else preferences["hideDoneTasks"]
    if hide_done:
        where.append("t.status_id<>'done'")
    if user["role"] in ("lead", "member"):
        lead_teams = teams_for_user(db, user["id"])
        if lead_teams:
            placeholders = ",".join(["%s"] * len(lead_teams))
            where.append(f"t.team_id IN ({placeholders})")
            args.extend(lead_teams)
        else:
            where.append("1=0")
    elif filters.get("team_id"):
        where.append("t.team_id=%s")
        args.append(filters["team_id"])
    if filters.get("member_id"):
        where.append("EXISTS (SELECT 1 FROM task_assignments ta WHERE ta.task_id=t.id AND ta.user_id=%s)")
        args.append(filters["member_id"])
    if filters.get("parent_task_id"):
        where.append("t.parent_task_id=%s")
        args.append(filters["parent_task_id"])
    elif not truthy(filters.get("include_children")):
        where.append("t.parent_task_id IS NULL")
    for key, column in (("category", "category_id"), ("priority", "priority_id"), ("status", "status_id")):
        if filters.get(key):
            where.append(f"t.{column}=%s")
            args.append(filters[key])
    if filters.get("q"):
        where.append("(t.title LIKE %s OR t.description LIKE %s)")
        q = f"%{filters['q']}%"
        args.extend([q, q])
    rows = db.query(
        f"""
        SELECT t.*, p.name AS project_name, p.redmine_identifier, rt.redmine_issue_id, rt.issue_key
        FROM tasks t
        LEFT JOIN projects p ON p.id=t.project_id
        LEFT JOIN redmine_tickets rt ON rt.id=t.redmine_ticket_id
        WHERE {' AND '.join(where)}
        ORDER BY t.due_date IS NULL, t.due_date, t.updated_at DESC
        """,
        args,
    )
    return [task_payload(db, row) for row in rows]


def truthy(value):
    return str(value or "").strip().lower() in ("1", "true", "yes", "on")


def get_task(db, task_id):
    row = db.one(
        """
        SELECT t.*, p.name AS project_name, p.redmine_identifier, rt.redmine_issue_id, rt.issue_key
        FROM tasks t
        LEFT JOIN projects p ON p.id=t.project_id
        LEFT JOIN redmine_tickets rt ON rt.id=t.redmine_ticket_id
        WHERE t.id=%s AND t.deleted_at IS NULL
        """,
        (task_id,),
    )
    return task_payload(db, row) if row else None


def task_payload(db, row):
    assignments = db.query(
        """
        SELECT ta.source, u.* FROM task_assignments ta JOIN users u ON u.id=ta.user_id
        WHERE ta.task_id=%s ORDER BY u.first_name,u.last_name
        """,
        (row["id"],),
    )
    members = [member_payload(user) for user in assignments]
    return {
        "id": row["id"],
        "teamId": row["team_id"],
        "projectId": row.get("project_id"),
        "parentTaskId": row.get("parent_task_id"),
        "projectName": row.get("project_name") or "",
        "categoryId": row["category_id"],
        "priorityId": row["priority_id"],
        "statusId": row["status_id"],
        "title": row["title"],
        "description": row.get("description") or "",
        "progress": int(row.get("progress") or 0),
        "startDate": date_value(row.get("start_date")),
        "dueDate": date_value(row.get("due_date")),
        "redmineTicketId": row.get("redmine_ticket_id"),
        "redmineIssueId": row.get("redmine_issue_id"),
        "issueKey": row.get("issue_key") or "",
        "redmineLinked": bool(row.get("redmine_ticket_id")),
        "memberIds": [user["id"] for user in assignments],
        "members": members,
        "createdAt": date_value(row.get("created_at")),
        "updatedAt": date_value(row.get("updated_at")),
    }


def task_audit_history(db, task_id):
    rows = db.query(
        """
        SELECT audit.id, audit.action, audit.diff, audit.occurred_at,
          u.id AS user_id, u.display_name, u.first_name, u.last_name, u.username, u.email
        FROM task_audit_log audit
        LEFT JOIN users u ON u.id=audit.user_id
        WHERE audit.task_id=%s
        ORDER BY audit.occurred_at DESC, audit.id DESC
        """,
        (task_id,),
    )
    return [task_audit_payload(row) for row in rows]


def task_audit_payload(row):
    user_name = row.get("display_name") or f"{row.get('first_name') or ''} {row.get('last_name') or ''}".strip()
    raw_diff = row.get("diff")
    try:
        diff = json.loads(raw_diff) if isinstance(raw_diff, str) and raw_diff else (raw_diff or {})
    except (TypeError, json.JSONDecodeError):
        diff = {"raw": str(raw_diff or "")}
    return {
        "id": row["id"],
        "action": row["action"],
        "user": {
            "id": row.get("user_id"),
            "name": user_name or row.get("username") or row.get("email") or "System",
            "email": row.get("email") or "",
        },
        "occurredAt": date_value(row.get("occurred_at")),
        "changes": diff.get("changes") or [],
        "summary": diff.get("summary") or "",
        "details": diff,
    }


def child_progress_rollup(db, parent_task_id):
    summary = db.one(
        """
        SELECT COUNT(*) AS child_count, AVG(progress) AS average_progress
        FROM tasks
        WHERE parent_task_id=%s AND deleted_at IS NULL
        """,
        (parent_task_id,),
    )
    if not summary or not int(summary.get("child_count") or 0):
        return None
    return int(round(float(summary.get("average_progress") or 0)))


def refresh_parent_progress_rollup(db, parent_task_id):
    if not parent_task_id:
        return None
    progress = child_progress_rollup(db, parent_task_id)
    if progress is None:
        return None
    db.execute(
        "UPDATE tasks SET progress=%s, updated_at=UTC_TIMESTAMP() WHERE id=%s AND deleted_at IS NULL",
        (progress, parent_task_id),
    )
    return progress


def refresh_parent_progress_rollups(db, parent_task_ids):
    refreshed = {}
    for parent_task_id in {int(value) for value in parent_task_ids if value}:
        progress = refresh_parent_progress_rollup(db, parent_task_id)
        if progress is not None:
            refreshed[parent_task_id] = progress
    return refreshed


def _synced_fields_changed(existing, payload):
    field_map = {
        "priorityId": "priorityId",
        "statusId": "statusId",
        "progress": "progress",
        "startDate": "startDate",
        "dueDate": "dueDate",
        "memberIds": "memberIds",
    }
    for payload_key, existing_key in field_map.items():
        if payload_key not in payload:
            continue
        incoming = payload[payload_key]
        current = existing.get(existing_key)
        if payload_key == "memberIds":
            if sorted(str(x) for x in (incoming or [])) != sorted(str(x) for x in (current or [])):
                return True
        else:
            if str(incoming or "") != str(current or ""):
                return True
    return False


def save_task(db, user, payload, task_id=None):
    if not can_mutate_team(db, user, payload.get("teamId")):
        raise PermissionError("You do not have access to this team.")
    data = normalize_task_input(payload)
    parent_rollups = set()
    with db.transaction() as conn:
        with conn.cursor() as cursor:
            if task_id:
                existing = get_task(db, task_id)
                if not existing:
                    raise KeyError("Task not found.")
                parent_rollups.update([existing.get("parentTaskId"), data["parentTaskId"]])
                if existing["redmineLinked"] and _synced_fields_changed(existing, payload):
                    raise ValueError("Synced fields are owned by Redmine. Unlink the task before editing them.")
                cursor.execute(
                    """
                    UPDATE tasks SET team_id=%s, project_id=%s, parent_task_id=%s, category_id=%s, priority_id=%s,
                      title=%s, description=%s, updated_by_user_id=%s
                    WHERE id=%s
                    """,
                    (data["teamId"], data["projectId"], data["parentTaskId"], data["categoryId"], data["priorityId"],
                     data["title"], data["description"], user["id"], task_id),
                )
                if not existing["redmineLinked"]:
                    cursor.execute(
                        "UPDATE tasks SET status_id=%s, progress=%s, start_date=%s, due_date=%s WHERE id=%s",
                        (data["statusId"], data["progress"], data["startDate"], data["dueDate"], task_id),
                    )
                    replace_task_members(cursor, task_id, data["memberIds"], "manual")
                write_audit(cursor, task_id, user["id"], "updated", task_change_diff(existing, data))
            else:
                cursor.execute(
                    """
                    INSERT INTO tasks
                      (team_id, project_id, parent_task_id, category_id, priority_id, status_id, title, description, progress, start_date, due_date, created_by_user_id, updated_by_user_id)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """,
                    (data["teamId"], data["projectId"], data["parentTaskId"], data["categoryId"], data["priorityId"],
                     data["statusId"], data["title"], data["description"], data["progress"],
                     data["startDate"], data["dueDate"], user["id"], user["id"]),
                )
                task_id = cursor.lastrowid
                parent_rollups.add(data["parentTaskId"])
                replace_task_members(cursor, task_id, data["memberIds"], "manual")
                write_audit(cursor, task_id, user["id"], "created", task_create_diff(data))
    refresh_parent_progress_rollup(db, task_id)
    refresh_parent_progress_rollups(db, parent_rollups)
    return get_task(db, task_id)


def normalize_task_input(payload):
    return {
        "teamId": str(payload.get("teamId") or "").strip(),
        "projectId": int(payload["projectId"]) if payload.get("projectId") else None,
        "parentTaskId": int(payload["parentTaskId"]) if payload.get("parentTaskId") else None,
        "categoryId": str(payload.get("categoryId") or "dev").strip(),
        "priorityId": str(payload.get("priorityId") or "medium").strip(),
        "statusId": str(payload.get("statusId") or "new").strip(),
        "title": str(payload.get("title") or "").strip(),
        "description": str(payload.get("description") or "").strip(),
        "progress": max(0, min(100, int(payload.get("progress") or 0))),
        "startDate": payload.get("startDate") or None,
        "dueDate": payload.get("dueDate") or None,
        "memberIds": [int(value) for value in payload.get("memberIds") or [] if str(value).isdigit()],
    }


def can_mutate_team(db, user, team_id):
    if user["role"] in ("manager", "admin"):
        return True
    if user["role"] == "lead":
        return team_id in teams_for_user(db, user["id"])
    return False


def replace_task_members(cursor, task_id, member_ids, source):
    cursor.execute("DELETE FROM task_assignments WHERE task_id=%s", (task_id,))
    for member_id in member_ids:
        cursor.execute(
            "INSERT IGNORE INTO task_assignments (task_id,user_id,source) VALUES (%s,%s,%s)",
            (task_id, member_id, source),
        )


def write_audit(cursor, task_id, user_id, action, diff):
    cursor.execute(
        "INSERT INTO task_audit_log (task_id,user_id,action,diff) VALUES (%s,%s,%s,%s)",
        (task_id, user_id, action, json.dumps(diff, default=str)),
    )


def record_task_audit(db, task_id, user_id, action, diff):
    db.execute(
        "INSERT INTO task_audit_log (task_id,user_id,action,diff) VALUES (%s,%s,%s,%s)",
        (task_id, user_id, action, json.dumps(diff, default=str)),
    )


def task_create_diff(data):
    return {
        "summary": "Task created",
        "changes": [{"field": label, "before": "", "after": audit_display_value(key, data.get(key))} for key, label in task_audit_fields()],
    }


def task_change_diff(existing, data):
    changes = []
    for key, label in task_audit_fields():
        before = existing.get(key)
        after = data.get(key)
        if normalize_audit_value(before) != normalize_audit_value(after):
            changes.append({
                "field": label,
                "before": audit_display_value(key, before),
                "after": audit_display_value(key, after),
            })
    return {
        "summary": f"{len(changes)} field(s) changed" if changes else "Task saved without visible field changes",
        "changes": changes,
    }


def task_audit_fields():
    return (
        ("teamId", "Team"),
        ("projectId", "Project"),
        ("parentTaskId", "Depends on"),
        ("categoryId", "Category"),
        ("priorityId", "Priority"),
        ("statusId", "Status"),
        ("title", "Title"),
        ("description", "Description"),
        ("progress", "Progress"),
        ("startDate", "Start date"),
        ("dueDate", "Due date"),
        ("memberIds", "Assigned members"),
    )


def normalize_audit_value(value):
    if isinstance(value, list):
        return sorted(str(item) for item in value)
    return "" if value is None else str(value)


def audit_display_value(key, value):
    if isinstance(value, list):
        return ", ".join(str(item) for item in value) if value else "None"
    if key == "progress" and value not in (None, ""):
        return f"{value}%"
    return str(value) if value not in (None, "") else "Not set"


def soft_delete_task(db, user, task_id):
    task = get_task(db, task_id)
    if not task:
        return False
    if not can_mutate_team(db, user, task["teamId"]):
        raise PermissionError("You do not have access to this team.")
    db.execute("UPDATE tasks SET deleted_at=UTC_TIMESTAMP(), updated_by_user_id=%s WHERE id=%s", (user["id"], task_id))
    record_task_audit(db, task_id, user["id"], "deleted", {"summary": "Task deleted", "changes": []})
    refresh_parent_progress_rollup(db, task["parentTaskId"])
    return True


def link_task_to_ticket(db, redmine, api_key, user, task_id, value):
    task = get_task(db, task_id)
    if not task:
        raise KeyError("Task not found.")
    if not can_mutate_team(db, user, task["teamId"]):
        raise PermissionError("You do not have access to this team.")
    ticket = get_or_fetch_ticket(db, redmine, api_key, value)
    if not ticket:
        raise ValueError("Could not identify a Redmine issue from that value.")
    db.execute(
        """
        UPDATE tasks SET redmine_ticket_id=%s,status_id=%s,priority_id=%s,progress=%s,start_date=%s,due_date=%s,last_redmine_sync_at=UTC_TIMESTAMP()
        WHERE id=%s
        """,
        (ticket["id"], ticket["statusId"], ticket["priorityId"], ticket["progress"], ticket["startDate"] or None, ticket["dueDate"] or None, task_id),
    )
    db.execute("DELETE FROM task_assignments WHERE task_id=%s", (task_id,))
    for member_id in ticket_subtree_assignee_ids(db, ticket["id"]) or ticket["assigneeIds"]:
        db.execute("INSERT IGNORE INTO task_assignments (task_id,user_id,source) VALUES (%s,%s,'redmine')", (task_id, member_id))
    refresh_parent_progress_rollup(db, task_id)
    refresh_parent_progress_rollup(db, task["parentTaskId"])
    updated = get_task(db, task_id)
    record_task_audit(db, task_id, user["id"], "linked_redmine", task_change_diff(task, updated))
    return updated


def unlink_task(db, user, task_id):
    task = get_task(db, task_id)
    if not task:
        raise KeyError("Task not found.")
    if not can_mutate_team(db, user, task["teamId"]):
        raise PermissionError("You do not have access to this team.")
    db.execute("UPDATE tasks SET redmine_ticket_id=NULL,last_redmine_sync_at=NULL WHERE id=%s", (task_id,))
    db.execute("UPDATE task_assignments SET source='manual' WHERE task_id=%s", (task_id,))
    refresh_parent_progress_rollup(db, task_id)
    refresh_parent_progress_rollup(db, task["parentTaskId"])
    updated = get_task(db, task_id)
    record_task_audit(db, task_id, user["id"], "unlinked_redmine", {
        "summary": "Redmine ticket unlinked",
        "changes": [{"field": "Redmine ticket", "before": task.get("issueKey") or task.get("redmineIssueId") or "Linked", "after": "Not set"}],
    })
    return updated


def apply_redmine_ticket_to_task(db, user, task, ticket, audit_action="redmine_sync"):
    db.execute(
        """
        UPDATE tasks
        SET status_id=%s, priority_id=%s, progress=%s, start_date=%s, due_date=%s, last_redmine_sync_at=UTC_TIMESTAMP()
        WHERE id=%s
        """,
        (ticket["statusId"], ticket["priorityId"], ticket["progress"], ticket["startDate"] or None, ticket["dueDate"] or None, task["id"]),
    )
    db.execute("DELETE FROM task_assignments WHERE task_id=%s", (task["id"],))
    for member_id in ticket_subtree_assignee_ids(db, ticket["id"]) or ticket["assigneeIds"]:
        db.execute(
            "INSERT IGNORE INTO task_assignments (task_id,user_id,source) VALUES (%s,%s,'redmine')",
            (task["id"], member_id),
        )
    refresh_parent_progress_rollup(db, task["id"])
    refresh_parent_progress_rollup(db, task.get("parentTaskId"))
    updated = get_task(db, task["id"])
    if user and audit_action:
        diff = task_change_diff(task, updated)
        if diff["changes"]:
            record_task_audit(db, task["id"], user["id"], audit_action, diff)
    return updated


def sync_linked_task(db, redmine, api_key, user, task_id):
    task = get_task(db, task_id)
    if not task:
        raise KeyError("Task not found.")
    if not can_mutate_team(db, user, task["teamId"]):
        raise PermissionError("You do not have access to this team.")
    if not task.get("redmineLinked") or not task.get("redmineIssueId"):
        raise ValueError("This task is not linked to a Redmine ticket.")
    ticket = refresh_ticket(db, redmine, api_key, task["redmineIssueId"])
    if not ticket:
        raise ValueError("Unable to refresh the linked Redmine ticket.")
    return apply_redmine_ticket_to_task(db, user, task, ticket)


def sync_linked_tasks(db, redmine, api_key, user):
    if user["role"] not in ("manager", "admin"):
        raise PermissionError("Only managers can run Redmine sync.")

    rows = db.query(
        """
        SELECT t.id AS task_id, rt.redmine_issue_id
        FROM tasks t JOIN redmine_tickets rt ON rt.id=t.redmine_ticket_id
        WHERE t.deleted_at IS NULL AND t.redmine_ticket_id IS NOT NULL
        ORDER BY t.last_redmine_sync_at IS NULL DESC, t.last_redmine_sync_at
        """
    )
    synced = []
    parent_rollups = set()
    for row in rows:
        ticket = refresh_ticket(db, redmine, api_key, row["redmine_issue_id"])
        if not ticket:
            continue
        task = get_task(db, row["task_id"])
        if not task:
            continue
        parent_rollups.add(task.get("parentTaskId"))
        apply_redmine_ticket_to_task(db, user, task, ticket)
        synced.append(row["task_id"])
    refresh_parent_progress_rollups(db, [*parent_rollups, *synced])
    return {"syncedTaskIds": synced, "count": len(synced)}

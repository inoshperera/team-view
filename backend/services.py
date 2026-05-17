import hashlib
import json
import re
import uuid
from datetime import datetime, timedelta
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SYNCED_FIELDS = {"statusId", "progress", "startDate", "dueDate", "memberIds"}


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


def upsert_user_from_redmine(db, redmine_user):
    redmine_id = int(redmine_user.get("id") or 0)
    username = str(redmine_user.get("login") or "").strip()
    first = str(redmine_user.get("firstname") or username or "Redmine").strip()
    last = str(redmine_user.get("lastname") or "User").strip()
    email = str(redmine_user.get("mail") or "").strip() or None
    avatar_url = str(redmine_user.get("avatar_url") or "").strip() or None
    existing = db.one("SELECT * FROM users WHERE redmine_user_id=%s OR username=%s LIMIT 1", (redmine_id, username))
    role = existing["role"] if existing else ("admin" if redmine_user.get("admin") else "member")
    if redmine_user.get("admin") and role == "member":
        role = "admin"
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
          role=IF(role='member', VALUES(role), role),
          is_active=1,
          last_login_at=UTC_TIMESTAMP()
        """,
        (redmine_id, first, last, email, avatar_url, username, role, avatar_class(redmine_id)),
    )
    return db.one("SELECT * FROM users WHERE redmine_user_id=%s", (redmine_id,))


def sync_redmine_users(db, redmine, api_key):
    try:
        payload = redmine.get("/users.json", api_key, {"status": 1, "limit": 100})
    except Exception:
        return
    for raw in payload.get("users", []):
        upsert_user_from_redmine(db, raw)


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
        WHERE s.token_hash=%s AND s.expires_at > UTC_TIMESTAMP()
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
    row = db.one(
        """
        SELECT t.id FROM teams t
        LEFT JOIN team_members tm ON tm.team_id=t.id
        WHERE t.lead_user_id=%s OR tm.user_id=%s
        ORDER BY t.lead_user_id=%s DESC, t.name
        LIMIT 1
        """,
        (user_id, user_id, user_id),
    )
    return row["id"] if row else None


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
        db.execute("INSERT INTO teams (id,name) VALUES (%s,%s) ON DUPLICATE KEY UPDATE name=VALUES(name)", (team_id, name))
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


def list_teams(db):
    teams = db.query(
        """
        SELECT t.*, COUNT(tm.user_id) AS memberCount
        FROM teams t LEFT JOIN team_members tm ON tm.team_id=t.id
        WHERE t.is_active=1
        GROUP BY t.id
        ORDER BY t.name
        """
    )
    return [{"id": t["id"], "name": t["name"], "memberCount": t["memberCount"]} for t in teams]


def team_config_payload(db):
    payload = []
    for team in db.query("SELECT id,name FROM teams WHERE is_active=1 ORDER BY name"):
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
                cursor.execute(
                    """
                    INSERT INTO teams (id,name,is_active)
                    VALUES (%s,%s,1)
                    ON DUPLICATE KEY UPDATE name=VALUES(name), is_active=1
                    """,
                    (team_id, name),
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
        SELECT u.* FROM users u JOIN team_members tm ON tm.user_id=u.id
        WHERE tm.team_id=%s AND u.is_active=1
        ORDER BY u.first_name,u.last_name
        """,
        (team_id,),
    )
    return {"id": team["id"], "name": team["name"], "members": [member_payload(m, team_id) for m in members]}


def list_users(db):
    rows = db.query(
        """
        SELECT u.*, GROUP_CONCAT(tm.team_id ORDER BY tm.team_id) AS team_ids
        FROM users u LEFT JOIN team_members tm ON tm.user_id=u.id
        WHERE u.is_active=1
        GROUP BY u.id
        ORDER BY u.first_name,u.last_name
        """
    )
    users = []
    for row in rows:
        team_ids = [value for value in str(row.get("team_ids") or "").split(",") if value]
        users.append(member_payload(row, team_ids[0] if team_ids else None, team_ids))
    return users


def member_payload(user, team_id=None, team_ids=None):
    display = user.get("display_name") or f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
    return {
        "id": user["id"],
        "redmineUserId": user.get("redmine_user_id"),
        "name": display,
        "teamId": team_id,
        "teamIds": team_ids or ([team_id] if team_id else []),
        "avatarUrl": user.get("avatar_url") or "",
        "avatarColor": user.get("avatar_color") or avatar_class(user["id"]),
        "initials": initials(display),
    }


def list_projects(db):
    return db.query(
        """
        SELECT id,name,source,redmine_identifier AS redmineIdentifier,owner_team_id AS ownerTeamId
        FROM projects WHERE is_active=1 ORDER BY source DESC,name
        """
    )


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
    identifier = project.get("identifier") or (str(project.get("name") or "").lower().replace(" ", "-") or None)
    name = project.get("name") or identifier or "Redmine project"
    if redmine_id:
        db.execute(
            """
            INSERT INTO projects (name,source,redmine_project_id,redmine_identifier)
            VALUES (%s,'redmine',%s,%s)
            ON DUPLICATE KEY UPDATE name=VALUES(name), redmine_identifier=VALUES(redmine_identifier), is_active=1
            """,
            (name, redmine_id, identifier),
        )
        return db.one("SELECT id FROM projects WHERE redmine_project_id=%s", (redmine_id,))["id"]
    db.execute(
        """
        INSERT INTO projects (name,source,redmine_identifier)
        VALUES (%s,'redmine',%s)
        ON DUPLICATE KEY UPDATE name=VALUES(name), is_active=1
        """,
        (name, identifier),
    )
    return db.one("SELECT id FROM projects WHERE redmine_identifier=%s", (identifier,))["id"]


def replace_ticket_assignees(db, ticket_id, issue):
    assignee = issue.get("assigned_to") or {}
    db.execute("DELETE FROM redmine_ticket_assignees WHERE ticket_id=%s", (ticket_id,))
    if not assignee.get("id"):
        return
    user = db.one("SELECT id FROM users WHERE redmine_user_id=%s", (int(assignee["id"]),))
    if user:
        db.execute("INSERT IGNORE INTO redmine_ticket_assignees (ticket_id,user_id) VALUES (%s,%s)", (ticket_id, user["id"]))


def map_status(name):
    value = str(name or "").lower()
    if "closed" in value or "done" in value:
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
    params = {"status_id": "*", "sort": "created_on:desc", "limit": 25}
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
    if user["role"] == "lead":
        team_id = primary_team_for_user(db, user["id"])
        where.append("t.team_id=%s")
        args.append(team_id or "")
    elif filters.get("team_id"):
        where.append("t.team_id=%s")
        args.append(filters["team_id"])
    if filters.get("member_id"):
        where.append("EXISTS (SELECT 1 FROM task_assignments ta WHERE ta.task_id=t.id AND ta.user_id=%s)")
        args.append(filters["member_id"])
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
        JOIN projects p ON p.id=t.project_id
        LEFT JOIN redmine_tickets rt ON rt.id=t.redmine_ticket_id
        WHERE {' AND '.join(where)}
        ORDER BY t.due_date IS NULL, t.due_date, t.updated_at DESC
        """,
        args,
    )
    return [task_payload(db, row) for row in rows]


def get_task(db, task_id):
    row = db.one(
        """
        SELECT t.*, p.name AS project_name, p.redmine_identifier, rt.redmine_issue_id, rt.issue_key
        FROM tasks t
        JOIN projects p ON p.id=t.project_id
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
        "projectId": row["project_id"],
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


def save_task(db, user, payload, task_id=None):
    if not can_mutate_team(db, user, payload.get("teamId")):
        raise PermissionError("You do not have access to this team.")
    data = normalize_task_input(payload)
    with db.transaction() as conn:
        with conn.cursor() as cursor:
            if task_id:
                existing = get_task(db, task_id)
                if not existing:
                    raise KeyError("Task not found.")
                if existing["redmineLinked"] and any(key in payload for key in SYNCED_FIELDS):
                    raise ValueError("Synced fields are owned by Redmine. Unlink the task before editing them.")
                cursor.execute(
                    """
                    UPDATE tasks SET team_id=%s, project_id=%s, category_id=%s, priority_id=%s,
                      title=%s, description=%s, updated_by_user_id=%s
                    WHERE id=%s
                    """,
                    (data["teamId"], data["projectId"], data["categoryId"], data["priorityId"],
                     data["title"], data["description"], user["id"], task_id),
                )
                if not existing["redmineLinked"]:
                    cursor.execute(
                        "UPDATE tasks SET status_id=%s, progress=%s, start_date=%s, due_date=%s WHERE id=%s",
                        (data["statusId"], data["progress"], data["startDate"], data["dueDate"], task_id),
                    )
                    replace_task_members(cursor, task_id, data["memberIds"], "manual")
                write_audit(cursor, task_id, user["id"], "updated", payload)
            else:
                cursor.execute(
                    """
                    INSERT INTO tasks
                      (team_id, project_id, category_id, priority_id, status_id, title, description, progress, start_date, due_date, created_by_user_id, updated_by_user_id)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """,
                    (data["teamId"], data["projectId"], data["categoryId"], data["priorityId"],
                     data["statusId"], data["title"], data["description"], data["progress"],
                     data["startDate"], data["dueDate"], user["id"], user["id"]),
                )
                task_id = cursor.lastrowid
                replace_task_members(cursor, task_id, data["memberIds"], "manual")
                write_audit(cursor, task_id, user["id"], "created", payload)
    return get_task(db, task_id)


def normalize_task_input(payload):
    return {
        "teamId": str(payload.get("teamId") or "").strip(),
        "projectId": int(payload.get("projectId") or 0),
        "categoryId": str(payload.get("categoryId") or "dev").strip(),
        "priorityId": str(payload.get("priorityId") or "medium").strip(),
        "statusId": str(payload.get("statusId") or "working").strip(),
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
        return primary_team_for_user(db, user["id"]) == team_id
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


def soft_delete_task(db, user, task_id):
    task = get_task(db, task_id)
    if not task:
        return False
    if not can_mutate_team(db, user, task["teamId"]):
        raise PermissionError("You do not have access to this team.")
    db.execute("UPDATE tasks SET deleted_at=UTC_TIMESTAMP(), updated_by_user_id=%s WHERE id=%s", (user["id"], task_id))
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
    return get_task(db, task_id)


def unlink_task(db, user, task_id):
    task = get_task(db, task_id)
    if not task:
        raise KeyError("Task not found.")
    if not can_mutate_team(db, user, task["teamId"]):
        raise PermissionError("You do not have access to this team.")
    db.execute("UPDATE tasks SET redmine_ticket_id=NULL,last_redmine_sync_at=NULL WHERE id=%s", (task_id,))
    db.execute("UPDATE task_assignments SET source='manual' WHERE task_id=%s", (task_id,))
    return get_task(db, task_id)


def sync_linked_tasks(db, redmine, api_key, user):
    if user["role"] not in ("manager", "admin"):
        raise PermissionError("Only managers and admins can run Redmine sync.")

    rows = db.query(
        """
        SELECT t.id AS task_id, rt.redmine_issue_id
        FROM tasks t JOIN redmine_tickets rt ON rt.id=t.redmine_ticket_id
        WHERE t.deleted_at IS NULL AND t.redmine_ticket_id IS NOT NULL
        ORDER BY t.last_redmine_sync_at IS NULL DESC, t.last_redmine_sync_at
        """
    )
    synced = []
    for row in rows:
        ticket = refresh_ticket(db, redmine, api_key, row["redmine_issue_id"])
        if not ticket:
            continue
        db.execute(
            """
            UPDATE tasks
            SET status_id=%s, priority_id=%s, progress=%s, start_date=%s, due_date=%s, last_redmine_sync_at=UTC_TIMESTAMP()
            WHERE id=%s
            """,
            (ticket["statusId"], ticket["priorityId"], ticket["progress"], ticket["startDate"] or None, ticket["dueDate"] or None, row["task_id"]),
        )
        db.execute("DELETE FROM task_assignments WHERE task_id=%s", (row["task_id"],))
        for member_id in ticket_subtree_assignee_ids(db, ticket["id"]) or ticket["assigneeIds"]:
            db.execute(
                "INSERT IGNORE INTO task_assignments (task_id,user_id,source) VALUES (%s,%s,'redmine')",
                (row["task_id"], member_id),
            )
        synced.append(row["task_id"])
    return {"syncedTaskIds": synced, "count": len(synced)}

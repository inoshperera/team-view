#!/usr/bin/env python3
"""Import high-level planner tasks from an Excel workbook.

The script is intentionally dependency-free so it can run with the project's
existing Python setup. It reads the Tasks sheet from an .xlsx file, logs in to
the Birdseye backend, resolves dropdown labels through /api/bootstrap, and
creates tasks through /api/tasks.
"""

from __future__ import annotations

import argparse
import datetime as dt
import getpass
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_WORKBOOK = Path(__file__).with_name("high-level-task-import.xlsx")
ENVIRONMENT_URLS = {
    "local": "http://localhost:9000",
    "prod": "https://birdseye.entgra.net",
    "production": "https://birdseye.entgra.net",
}
XML_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
PKG_REL_NS = "{http://schemas.openxmlformats.org/package/2006/relationships}"


class ImportErrorWithContext(RuntimeError):
    pass


@dataclass
class TaskRow:
    row_number: int
    local_id: str
    depends_on: str
    raw: dict[str, Any]
    payload: dict[str, Any] | None = None


def normalize_key(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip()).lower()


def normalize_id(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if re.fullmatch(r"\d+\.0", text):
        return text[:-2]
    return text


def normalize_header(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").strip().lower())


def excel_serial_to_date(value: Any) -> str:
    if value in (None, ""):
        return ""
    if isinstance(value, dt.datetime):
        return value.date().isoformat()
    if isinstance(value, dt.date):
        return value.isoformat()
    text = str(value).strip()
    if not text:
        return ""
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        return text
    try:
        serial = float(text)
    except ValueError as exc:
        raise ImportErrorWithContext(f"Invalid date value: {text!r}") from exc
    # Excel's serial date system includes the historical 1900 leap-year bug.
    return (dt.date(1899, 12, 30) + dt.timedelta(days=serial)).isoformat()


def cell_ref_to_indexes(ref: str) -> tuple[int, int]:
    match = re.match(r"([A-Z]+)(\d+)", ref)
    if not match:
        raise ImportErrorWithContext(f"Invalid cell reference: {ref}")
    col_letters, row_text = match.groups()
    col = 0
    for char in col_letters:
        col = col * 26 + ord(char) - ord("A") + 1
    return int(row_text) - 1, col - 1


def read_shared_strings(zf: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    strings = []
    for item in root.findall(f"{XML_NS}si"):
        strings.append("".join(node.text or "" for node in item.iter(f"{XML_NS}t")))
    return strings


def workbook_sheets(zf: zipfile.ZipFile) -> dict[str, str]:
    workbook = ET.fromstring(zf.read("xl/workbook.xml"))
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    rel_targets = {
        rel.attrib["Id"]: rel.attrib["Target"]
        for rel in rels.findall(f"{PKG_REL_NS}Relationship")
    }
    sheets: dict[str, str] = {}
    for sheet in workbook.findall(f"{XML_NS}sheets/{XML_NS}sheet"):
        name = sheet.attrib["name"]
        rel_id = sheet.attrib[f"{REL_NS}id"]
        target = rel_targets[rel_id].lstrip("/")
        if not target.startswith("xl/"):
            target = f"xl/{target}"
        sheets[name] = target
    return sheets


def read_xlsx_rows(path: Path, sheet_name: str) -> list[list[Any]]:
    with zipfile.ZipFile(path) as zf:
        shared_strings = read_shared_strings(zf)
        sheets = workbook_sheets(zf)
        if sheet_name not in sheets:
            available = ", ".join(sorted(sheets))
            raise ImportErrorWithContext(f"Workbook has no sheet named {sheet_name!r}. Available sheets: {available}")
        root = ET.fromstring(zf.read(sheets[sheet_name]))
        rows: list[list[Any]] = []
        for row in root.findall(f"{XML_NS}sheetData/{XML_NS}row"):
            values: list[Any] = []
            for cell in row.findall(f"{XML_NS}c"):
                row_index, col_index = cell_ref_to_indexes(cell.attrib["r"])
                while len(rows) <= row_index:
                    rows.append([])
                values = rows[row_index]
                while len(values) <= col_index:
                    values.append(None)
                cell_type = cell.attrib.get("t")
                if cell_type == "inlineStr":
                    inline = cell.find(f"{XML_NS}is")
                    values[col_index] = "".join(node.text or "" for node in inline.iter(f"{XML_NS}t")) if inline is not None else ""
                    continue
                raw_value = cell.find(f"{XML_NS}v")
                if raw_value is None:
                    values[col_index] = None
                elif cell_type == "s":
                    values[col_index] = shared_strings[int(raw_value.text or "0")]
                else:
                    values[col_index] = raw_value.text
        return rows


def header_map(headers: list[Any]) -> dict[str, int]:
    return {normalize_header(header): index for index, header in enumerate(headers) if header}


def row_value(row: list[Any], headers: dict[str, int], *names: str) -> Any:
    for name in names:
        index = headers.get(normalize_header(name))
        if index is not None and index < len(row):
            return row[index]
    return None


def split_people(value: Any) -> list[str]:
    text = str(value or "").strip()
    if not text:
        return []
    return [part.strip() for part in re.split(r"[,;\n]+", text) if part.strip()]


class ApiClient:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.cookie = ""

    def request(self, method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        data = None
        headers = {"Accept": "application/json"}
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if self.cookie:
            headers["Cookie"] = self.cookie
        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                cookie = response.headers.get("Set-Cookie")
                if cookie:
                    self.cookie = cookie.split(";", 1)[0]
                payload = response.read().decode("utf-8")
                return json.loads(payload) if payload else {}
        except urllib.error.HTTPError as exc:
            payload = exc.read().decode("utf-8", errors="replace")
            try:
                detail = json.loads(payload)
            except json.JSONDecodeError:
                detail = {"error": payload or exc.reason}
            message = detail.get("error") or detail.get("detail") or exc.reason
            raise ImportErrorWithContext(f"{method} {path} failed with HTTP {exc.code}: {message}") from exc
        except urllib.error.URLError as exc:
            raise ImportErrorWithContext(f"Unable to reach {url}: {exc.reason}") from exc

    def login(self, username: str, password: str) -> None:
        self.request("POST", "/api/auth/login", {"username": username, "password": password})


def index_by_label(items: list[dict[str, Any]], label_key: str = "label") -> dict[str, Any]:
    result: dict[str, Any] = {}
    for item in items:
        item_id = item.get("id")
        for value in (item_id, item.get(label_key), item.get("name"), item.get("redmineIdentifier")):
            key = normalize_key(value)
            if key:
                result[key] = item
    return result


def build_indexes(bootstrap: dict[str, Any]) -> dict[str, dict[str, Any]]:
    users: dict[str, Any] = {}
    for user in bootstrap.get("users", []):
        for value in (
            user.get("id"),
            user.get("name"),
            user.get("email"),
            user.get("username"),
            user.get("externalMemberId"),
            user.get("redmineUserId"),
        ):
            key = normalize_key(value)
            if key:
                users[key] = user
    return {
        "teams": index_by_label(bootstrap.get("teams", []), "name"),
        "categories": index_by_label(bootstrap.get("categories", [])),
        "priorities": index_by_label(bootstrap.get("priorities", [])),
        "statuses": index_by_label(bootstrap.get("statuses", [])),
        "projects": index_by_label(bootstrap.get("projects", []), "name"),
        "users": users,
    }


def lookup(indexes: dict[str, dict[str, Any]], kind: str, value: Any, row_number: int, required: bool = True) -> Any:
    text = str(value or "").strip()
    if not text:
        if required:
            raise ImportErrorWithContext(f"Row {row_number}: missing required {kind}.")
        return None
    item = indexes[kind].get(normalize_key(text))
    if not item:
        raise ImportErrorWithContext(f"Row {row_number}: unknown {kind} {text!r}. Check /api/bootstrap values.")
    return item


def resolve_base_url(environment: str, base_url: str | None) -> str:
    if base_url:
        return base_url
    try:
        return ENVIRONMENT_URLS[environment]
    except KeyError as exc:
        choices = ", ".join(sorted(ENVIRONMENT_URLS))
        raise ImportErrorWithContext(f"Unknown environment {environment!r}. Use one of: {choices}") from exc


def parse_task_rows(workbook: Path) -> list[TaskRow]:
    rows = read_xlsx_rows(workbook, "Tasks")
    if not rows:
        raise ImportErrorWithContext("Tasks sheet is empty.")
    headers = header_map(rows[0])
    required_headers = ["taskid", "team", "title", "category", "priority", "status", "startdate"]
    missing = [name for name in required_headers if name not in headers]
    if missing:
        raise ImportErrorWithContext(f"Tasks sheet is missing required columns: {', '.join(missing)}")
    task_rows: list[TaskRow] = []
    for offset, row in enumerate(rows[1:], start=2):
        if not any(str(value or "").strip() for value in row):
            continue
        local_id = normalize_id(row_value(row, headers, "Task ID"))
        title = str(row_value(row, headers, "Title") or "").strip()
        if not local_id and not title:
            continue
        raw = {
            "task_id": local_id,
            "depends_on": normalize_id(row_value(row, headers, "Depends On Task ID", "Depends On Task ID 1")),
            "team": row_value(row, headers, "Team"),
            "title": title,
            "category": row_value(row, headers, "Category"),
            "priority": row_value(row, headers, "Priority"),
            "project": row_value(row, headers, "Project"),
            "redmine_ticket": row_value(row, headers, "Redmine Ticket"),
            "status": row_value(row, headers, "Status"),
            "progress": row_value(row, headers, "Progress %"),
            "start_date": row_value(row, headers, "Start Date"),
            "due_date": row_value(row, headers, "Due Date"),
            "assigned_member": row_value(row, headers, "Assigned Member", "Assigned Members", "Assigned Member 1"),
            "description": row_value(row, headers, "Description / Acceptance Notes", "Description"),
            "upload_notes": row_value(row, headers, "Upload Notes"),
        }
        if not local_id:
            raise ImportErrorWithContext(f"Row {offset}: Task ID is required.")
        if not title:
            raise ImportErrorWithContext(f"Row {offset}: Title is required.")
        task_rows.append(TaskRow(offset, local_id, raw["depends_on"], raw))
    duplicate_ids = sorted({row.local_id for row in task_rows if sum(1 for other in task_rows if other.local_id == row.local_id) > 1})
    if duplicate_ids:
        raise ImportErrorWithContext(f"Duplicate Task ID values in workbook: {', '.join(duplicate_ids)}")
    return task_rows


def payload_for_row(row: TaskRow, indexes: dict[str, dict[str, Any]], parent_task_id: int | None = None) -> dict[str, Any]:
    raw = row.raw
    team = lookup(indexes, "teams", raw["team"], row.row_number)
    category = lookup(indexes, "categories", raw["category"], row.row_number)
    priority = lookup(indexes, "priorities", raw["priority"], row.row_number)
    status = lookup(indexes, "statuses", raw["status"], row.row_number)
    project = lookup_optional_project(indexes, raw["project"], row.row_number)
    member_ids = []
    for person in split_people(raw["assigned_member"]):
        user = lookup(indexes, "users", person, row.row_number)
        member_ids.append(int(user["id"]))
    if not member_ids:
        raise ImportErrorWithContext(f"Row {row.row_number}: at least one Assigned Member is required.")
    progress_raw = raw["progress"]
    progress = int(float(progress_raw or 0))
    if progress < 0 or progress > 100:
        raise ImportErrorWithContext(f"Row {row.row_number}: Progress % must be between 0 and 100.")
    description = str(raw["description"] or "").strip()
    upload_notes = str(raw["upload_notes"] or "").strip()
    if upload_notes and not upload_notes.lower().startswith("example"):
        description = f"{description}\n\nUpload notes:\n{upload_notes}".strip()
    payload = {
        "teamId": team["id"],
        "projectId": project["id"] if project else None,
        "parentTaskId": parent_task_id,
        "categoryId": category["id"],
        "priorityId": priority["id"],
        "statusId": status["id"],
        "title": raw["title"],
        "description": description,
        "progress": progress,
        "startDate": excel_serial_to_date(raw["start_date"]),
        "dueDate": excel_serial_to_date(raw["due_date"]),
        "memberIds": sorted(set(member_ids)),
    }
    if payload["statusId"] != "new" and not payload["dueDate"]:
        raise ImportErrorWithContext(f"Row {row.row_number}: Due Date is required unless Status is New.")
    return payload


def lookup_optional_project(indexes: dict[str, dict[str, Any]], value: Any, row_number: int) -> Any:
    text = str(value or "").strip()
    if not text:
        return None
    project = indexes["projects"].get(normalize_key(text))
    if project:
        return project
    print(
        f"  warning row {row_number}: project {text!r} was not found in /api/bootstrap; importing without projectId.",
        file=sys.stderr,
    )
    return None


def find_ready_rows(task_rows: list[TaskRow], created_ids: dict[str, int]) -> list[TaskRow]:
    ready = []
    pending_ids = {row.local_id for row in task_rows}
    for row in task_rows:
        if not row.depends_on or row.depends_on in created_ids or row.depends_on not in pending_ids:
            ready.append(row)
    return ready


def existing_task_keys(client: ApiClient) -> set[tuple[str, str, str]]:
    payload = client.request("GET", "/api/tasks?include_children=1")
    keys = set()
    for task in payload.get("tasks", []):
        keys.add((normalize_key(task.get("teamId")), normalize_key(task.get("title")), str(task.get("startDate") or "")))
    return keys


def upload_tasks(client: ApiClient, rows: list[TaskRow], indexes: dict[str, dict[str, Any]], allow_duplicates: bool) -> None:
    pending = rows[:]
    created_ids: dict[str, int] = {}
    created_count = 0
    skipped = 0
    existing = existing_task_keys(client) if not allow_duplicates else set()
    while pending:
        ready = find_ready_rows(pending, created_ids)
        if not ready:
            blocked = ", ".join(f"{row.local_id} -> {row.depends_on}" for row in pending)
            raise ImportErrorWithContext(f"Could not resolve task dependencies. Missing or circular references: {blocked}")
        for row in ready:
            if row.depends_on and row.depends_on not in created_ids:
                # Dependency points outside this workbook. Treat numeric values as existing system task IDs.
                try:
                    parent_task_id = int(row.depends_on)
                except ValueError as exc:
                    raise ImportErrorWithContext(f"Row {row.row_number}: dependency {row.depends_on!r} is not in this workbook and is not a numeric system task ID.") from exc
            else:
                parent_task_id = created_ids.get(row.depends_on)
            payload = payload_for_row(row, indexes, parent_task_id)
            row.payload = payload
            ticket = str(row.raw.get("redmine_ticket") or "").strip()
            duplicate_key = (normalize_key(payload["teamId"]), normalize_key(payload["title"]), str(payload["startDate"] or ""))
            if duplicate_key in existing:
                skipped += 1
                print(f"SKIP row {row.row_number} Task ID {row.local_id}: matching title/team/start date already exists.")
                pending.remove(row)
                continue
            print(f"CREATE row {row.row_number} Task ID {row.local_id}: {payload['title']}")
            print(f"  team={payload['teamId']} category={payload['categoryId']} priority={payload['priorityId']} status={payload['statusId']} members={payload['memberIds']} parent={payload['parentTaskId']}")
            response = client.request("POST", "/api/tasks", payload)
            task = response["task"]
            created_ids[row.local_id] = int(task["id"])
            created_count += 1
            existing.add(duplicate_key)
            print(f"  created system task id={task['id']}")
            if ticket:
                try:
                    client.request("POST", f"/api/tasks/{task['id']}/link", {"value": ticket})
                    print(f"  linked Redmine ticket {ticket}")
                except ImportErrorWithContext as exc:
                    print(f"  warning: task was created but Redmine link failed: {exc}", file=sys.stderr)
            pending.remove(row)
    print(f"Done. Parsed {len(rows)} row(s); created {created_count}; skipped {skipped}.")


def check_tasks(client: ApiClient, rows: list[TaskRow], indexes: dict[str, dict[str, Any]]) -> int:
    issues = 0
    created_ids: dict[str, int] = {}
    existing = existing_task_keys(client)
    print(f"Checking {len(rows)} workbook row(s).")
    for row in rows:
        parent_task_id = None
        if row.depends_on and row.depends_on not in {other.local_id for other in rows}:
            try:
                parent_task_id = int(row.depends_on)
            except ValueError:
                parent_task_id = None
        try:
            payload = payload_for_row(row, indexes, parent_task_id)
        except ImportErrorWithContext as exc:
            issues += 1
            print(f"ERROR row {row.row_number} Task ID {row.local_id}: {exc}")
            continue
        duplicate_key = (normalize_key(payload["teamId"]), normalize_key(payload["title"]), str(payload["startDate"] or ""))
        status = "OK"
        notes = []
        if row.depends_on and row.depends_on not in {other.local_id for other in rows} and parent_task_id is None:
            issues += 1
            status = "ERROR"
            notes.append(f"dependency {row.depends_on!r} is not in workbook and is not a numeric system task ID")
        if duplicate_key in existing:
            status = "WARN" if status == "OK" else status
            notes.append("matching title/team/start date already exists and would be skipped")
        if row.raw.get("redmine_ticket"):
            notes.append("Redmine ticket link may overwrite status, priority, dates, progress, and members")
        print(
            f"{status} row {row.row_number} Task ID {row.local_id}: "
            f"team={payload['teamId']} title={payload['title']!r} memberIds={payload['memberIds']}"
        )
        for note in notes:
            print(f"  - {note}")
        created_ids[row.local_id] = 0
    print(f"Check complete. Rows={len(rows)} issues={issues}.")
    return issues


def main() -> int:
    parser = argparse.ArgumentParser(description="Import high-level planner tasks from an Excel workbook.")
    parser.add_argument("--workbook", default=str(DEFAULT_WORKBOOK), help="Path to .xlsx workbook. Defaults to the copied workbook beside this script.")
    parser.add_argument("--env", choices=sorted(ENVIRONMENT_URLS), default="local", help="Target environment. Default: local.")
    parser.add_argument("--base-url", help="Override backend URL. Usually prefer --env local or --env production.")
    parser.add_argument("--username", required=True, help="Redmine/Birdseye username.")
    parser.add_argument("--password", help="Redmine/Birdseye password. If omitted, you will be prompted securely.")
    parser.add_argument("--allow-duplicates", action="store_true", help="Allow creating rows whose title/team/start date already exists.")
    parser.add_argument("--check", action="store_true", help="Validate workbook rows against the target environment without creating tasks.")
    args = parser.parse_args()

    password = args.password if args.password is not None else getpass.getpass("Password: ")
    workbook = Path(args.workbook).expanduser().resolve()
    if not workbook.exists():
        raise ImportErrorWithContext(f"Workbook not found: {workbook}")

    base_url = resolve_base_url(args.env, args.base_url)
    print(f"Target environment: {args.env} ({base_url})")
    client = ApiClient(base_url)
    client.login(args.username, password)
    bootstrap = client.request("GET", "/api/bootstrap")
    indexes = build_indexes(bootstrap)
    rows = parse_task_rows(workbook)
    if args.check:
        return 1 if check_tasks(client, rows, indexes) else 0
    upload_tasks(client, rows, indexes, allow_duplicates=args.allow_duplicates)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ImportErrorWithContext as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)

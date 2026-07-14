# High-Level Task Import

This folder contains a local importer for the high-level planner task workbook.

## Files

- `high-level-task-import.xlsx` - copied input workbook.
- `import_tasks.py` - dependency-free Python importer.

The importer reads this local `.xlsx` file. If the team changes the Google
Sheets version, download/export it and replace `high-level-task-import.xlsx`
before running the script.

## Run Local Import

Start the local app first:

```bash
APP_HOST=127.0.0.1 PROXY_HOST=127.0.0.1 scripts/servers.sh restart
```

Run the import:

```bash
python3 imports/high-level-task-import/import_tasks.py \
  --username YOUR_USERNAME
```

The script prompts for your password and logs in through the local backend at
`http://localhost:9000`, then creates the workbook tasks immediately.

## Run Production Import

Use the production environment selector:

```bash
python3 imports/high-level-task-import/import_tasks.py \
  --env production \
  --username YOUR_USERNAME
```

## Validate Before Import

To check workbook values against an environment without creating tasks:

```bash
python3 imports/high-level-task-import/import_tasks.py \
  --env local \
  --username YOUR_USERNAME \
  --check

python3 imports/high-level-task-import/import_tasks.py \
  --env production \
  --username YOUR_USERNAME \
  --check
```

Use `--env local` for the local backend and `--env production` for
`https://birdseye.entgra.net`. `--env prod` is also accepted as a shorter
production alias.

## Notes

- `Task ID` is the workbook-local ID.
- `Depends On Task ID` is resolved to the created parent task when it points to
  another workbook `Task ID`.
- If `Depends On Task ID` is not present in the workbook, numeric values are
  treated as existing system task IDs.
- The script skips likely duplicates by default: same title, team, and start
  date. Use `--allow-duplicates` only when you intentionally want duplicates.
- `Redmine Ticket` is linked after task creation. If linking fails, the task
  remains created and the script prints a warning.
- When a task is linked to a Redmine ticket, Redmine can overwrite synced fields
  such as status, priority, progress, dates, and assignees.
- Team, category, priority, status, and member names must match values returned
  by `/api/bootstrap` in the selected environment. Check production separately
  because the local directory can be stale or incomplete.

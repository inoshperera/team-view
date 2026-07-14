#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.server"
APP_PID_FILE="$RUN_DIR/app.pid"
PROXY_PID_FILE="$RUN_DIR/proxy.pid"
APP_LOG="$RUN_DIR/app.log"
PROXY_LOG="$RUN_DIR/proxy.log"

APP_HOST="${APP_HOST:-localhost}"
APP_PORT="${APP_PORT:-8000}"
PROXY_HOST="${PROXY_HOST:-localhost}"
PROXY_PORT="${PROXY_PORT:-9000}"
if [[ -x "$ROOT_DIR/.venv/bin/python" ]]; then
    PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv/bin/python}"
else
    PYTHON_BIN="${PYTHON_BIN:-python3}"
fi

usage() {
    cat <<USAGE
Usage: scripts/servers.sh <start|stop|restart|status|logs>

Environment overrides:
  APP_HOST=$APP_HOST
  APP_PORT=$APP_PORT
  PROXY_HOST=$PROXY_HOST
  PROXY_PORT=$PROXY_PORT
  PYTHON_BIN=$PYTHON_BIN

Examples:
  scripts/servers.sh start
  APP_PORT=8010 PROXY_PORT=9100 scripts/servers.sh restart
  scripts/servers.sh logs
USAGE
}

ensure_run_dir() {
    mkdir -p "$RUN_DIR"
}

is_running() {
    local pid_file="$1"
    [[ -f "$pid_file" ]] || return 1
    local pid
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    [[ -n "$pid" ]] || return 1
    kill -0 "$pid" 2>/dev/null
}

port_pids() {
    local port="$1"
    if command -v lsof >/dev/null 2>&1; then
        lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
    fi
}

start_process() {
    local name="$1"
    local pid_file="$2"
    local log_file="$3"
    local port="$4"
    shift 4

    if is_running "$pid_file"; then
        echo "$name already running with PID $(cat "$pid_file")."
        return
    fi

    local existing_pids
    existing_pids="$(port_pids "$port")"
    if [[ -n "$existing_pids" ]]; then
        echo "$name port $port is already in use by PID(s): ${existing_pids//$'\n'/, }."
        echo "Run scripts/servers.sh stop first, or choose a different port."
        return 1
    fi

    rm -f "$pid_file"
    : > "$log_file"
    "$PYTHON_BIN" - "$ROOT_DIR" "$log_file" "$pid_file" "$@" <<'PY'
import os
import subprocess
import sys

root_dir, log_file, pid_file, *command = sys.argv[1:]
log_handle = open(log_file, "ab", buffering=0)
process = subprocess.Popen(
    command,
    cwd=root_dir,
    stdout=log_handle,
    stderr=subprocess.STDOUT,
    stdin=subprocess.DEVNULL,
    start_new_session=True,
    close_fds=True,
)
with open(pid_file, "w", encoding="utf-8") as handle:
    handle.write(f"{process.pid}\n")
PY
    echo "Started $name with PID $(cat "$pid_file"). Log: $log_file"
}

stop_process() {
    local name="$1"
    local pid_file="$2"
    local port="$3"

    if ! is_running "$pid_file"; then
        rm -f "$pid_file"
        local existing_pids
        existing_pids="$(port_pids "$port")"
        if [[ -z "$existing_pids" ]]; then
            echo "$name is not running."
            return
        fi
        echo "$name has unmanaged listener PID(s) on port $port: ${existing_pids//$'\n'/, }."
        for pid in $existing_pids; do
            kill "$pid" 2>/dev/null || true
        done
        for _ in {1..20}; do
            if [[ -z "$(port_pids "$port")" ]]; then
                echo "Stopped unmanaged $name listener(s)."
                return
            fi
            sleep 0.2
        done
        for pid in $existing_pids; do
            kill -9 "$pid" 2>/dev/null || true
        done
        echo "Stopped unmanaged $name listener(s)."
        return
    fi

    local pid
    pid="$(cat "$pid_file")"
    kill "$pid"

    for _ in {1..20}; do
        if ! kill -0 "$pid" 2>/dev/null; then
            rm -f "$pid_file"
            echo "Stopped $name."
            return
        fi
        sleep 0.2
    done

    echo "$name did not stop cleanly; sending SIGKILL."
    kill -9 "$pid" 2>/dev/null || true
    rm -f "$pid_file"
}

start_servers() {
    ensure_run_dir
    start_process "static app" "$APP_PID_FILE" "$APP_LOG" "$APP_PORT" \
        "$PYTHON_BIN" -m http.server "$APP_PORT" --bind "$APP_HOST"
    start_process "Redmine proxy" "$PROXY_PID_FILE" "$PROXY_LOG" "$PROXY_PORT" \
        env PROXY_HOST="$PROXY_HOST" PROXY_PORT="$PROXY_PORT" "$PYTHON_BIN" proxy.py
    echo "App:   http://$APP_HOST:$APP_PORT"
    echo "Proxy: http://$PROXY_HOST:$PROXY_PORT"
}

stop_servers() {
    ensure_run_dir
    stop_process "Redmine proxy" "$PROXY_PID_FILE" "$PROXY_PORT"
    stop_process "static app" "$APP_PID_FILE" "$APP_PORT"
}

status_servers() {
    ensure_run_dir
    if is_running "$APP_PID_FILE"; then
        echo "static app running with PID $(cat "$APP_PID_FILE") at http://$APP_HOST:$APP_PORT"
    else
        app_port_pids="$(port_pids "$APP_PORT")"
        if [[ -n "$app_port_pids" ]]; then
            echo "static app port $APP_PORT has unmanaged listener PID(s): ${app_port_pids//$'\n'/, }"
        else
            echo "static app not running"
        fi
    fi

    if is_running "$PROXY_PID_FILE"; then
        echo "Redmine proxy running with PID $(cat "$PROXY_PID_FILE") at http://$PROXY_HOST:$PROXY_PORT"
    else
        proxy_port_pids="$(port_pids "$PROXY_PORT")"
        if [[ -n "$proxy_port_pids" ]]; then
            echo "Redmine proxy port $PROXY_PORT has unmanaged listener PID(s): ${proxy_port_pids//$'\n'/, }"
        else
            echo "Redmine proxy not running"
        fi
    fi
}

show_logs() {
    ensure_run_dir
    echo "== static app log =="
    if [[ -f "$APP_LOG" ]]; then
        tail -n 40 "$APP_LOG"
    else
        echo "No app log yet."
    fi
    echo
    echo "== Redmine proxy log =="
    if [[ -f "$PROXY_LOG" ]]; then
        tail -n 40 "$PROXY_LOG"
    else
        echo "No proxy log yet."
    fi
}

case "${1:-}" in
    start)
        start_servers
        ;;
    stop)
        stop_servers
        ;;
    restart)
        stop_servers
        start_servers
        ;;
    status)
        status_servers
        ;;
    logs)
        show_logs
        ;;
    -h|--help|help|"")
        usage
        ;;
    *)
        echo "Unknown command: $1" >&2
        usage >&2
        exit 1
        ;;
esac

# Birdseye Deployment And Developer Runbook

This document explains how this app is structured, how to make a change, and
how to deploy it to the current single-VM production setup.

## Production Architecture

Production runs on one Amazon Linux 2023 EC2 VM.

```text
Browser
  |
  | HTTPS https://birdseye.entgra.net
  v
Nginx :443
  |
  | serves static frontend files from /opt/birdseye/app
  | proxies API and Redmine passthrough routes
  v
Python backend on 127.0.0.1:9000
  |
  v
MySQL on 127.0.0.1:3306
  |
  v
Redmine API over HTTPS
```

Only Nginx should be public. The Python backend and MySQL must remain bound to
localhost and blocked by the AWS security group.

Public ports:

```text
443/tcp  HTTPS
22/tcp   SSH, preferably restricted to trusted IPs
```

Port `80/tcp` is currently blocked by policy. Because of this, Let's Encrypt
certificates are issued using manual DNS validation through GoDaddy.

Private/local-only ports:

```text
9000/tcp Python backend
3306/tcp MySQL
```

## Project Components

Frontend:

```text
index.html
styles.css
app.js
config.example.js
config.local.js
data/work-overview-phrases.json
```

The frontend is static HTML/CSS/vanilla JavaScript. There is no Node build step
for production.

Backend:

```text
proxy.py
redmine_proxy.py
backend/
requirements.txt
```

`proxy.py` is a small wrapper around `redmine_proxy.py`. The backend handles
login, HTTP-only sessions, Redmine API passthrough, team directory sync, planner
tasks, and API responses.

Database:

```text
db/schema.mysql.sql
```

The backend initializes/migrates the schema on startup. MySQL stores users,
sessions, teams, projects, planner tasks, Redmine ticket cache rows, assignments,
and audit rows.

Runtime config on the VM:

```text
/etc/birdseye.env
/opt/birdseye/app/config.local.js
```

Do not commit secrets. Redmine passwords are never stored in browser-readable
files.

## Environment Configuration

There are two config layers:

Frontend/browser config:

```text
config.example.js
config.local.js
```

The browser only needs to know where the backend is. Locally,
`config.example.js` defaults to:

```js
proxyUrl: "http://localhost:9000"
```

On the VM, `/opt/birdseye/app/config.local.js` overrides that with:

```js
proxyUrl: "https://birdseye.entgra.net"
```

Backend/server config:

```text
/etc/birdseye.env
```

The backend reads environment variables in `backend/config.py`.

Local defaults, when no env vars are set:

```text
REDMINE_URL=https://roadmap.staging.entgra.net
TEAM_VIEW_DB_HOST=localhost
TEAM_VIEW_DB_PORT=3306
TEAM_VIEW_DB_USER=root
TEAM_VIEW_DB_PASSWORD=root
TEAM_VIEW_DB_NAME=team_view
TEAM_VIEW_DEV_COOKIE=true
```

Production values live in `/etc/birdseye.env`, for example:

```text
REDMINE_URL=https://roadmap.entgra.net
TEAM_VIEW_DB_HOST=127.0.0.1
TEAM_VIEW_DB_USER=birdseye_app
TEAM_VIEW_DB_PASSWORD=...
TEAM_VIEW_DB_NAME=team_view
TEAM_VIEW_DEV_COOKIE=false
```

So local versus deployed behavior is controlled by environment variables, not
by changing code. To point a local backend at a different Redmine or database,
export env vars before starting `scripts/servers.sh`.

Example local staging run:

```bash
export REDMINE_URL=https://roadmap.staging.entgra.net
export TEAM_VIEW_DB_HOST=localhost
export TEAM_VIEW_DB_USER=root
export TEAM_VIEW_DB_PASSWORD=root
export TEAM_VIEW_DB_NAME=team_view
scripts/servers.sh restart
```

Example production check:

```bash
sudo cat /etc/birdseye.env
sudo systemctl restart birdseye-backend
```

## Production Services

The installer creates these services:

```text
mysqld
nginx
birdseye-backend
certbot-renew.timer
```

Useful commands:

```bash
sudo systemctl status birdseye-backend nginx mysqld --no-pager
sudo journalctl -u birdseye-backend -f
sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log
```

The backend emits structured logs for request start/end, request IDs, status,
duration, authenticated user id/role, audit events, and Redmine upstream calls.
Sensitive query keys such as passwords, tokens, session ids, and API keys are
redacted.

## Local Development

From the project folder:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp config.example.js config.local.js
```

Start the local static app and backend:

```bash
scripts/servers.sh start
```

Open:

```text
http://localhost:8000
```

Useful local commands:

```bash
scripts/servers.sh status
scripts/servers.sh logs
scripts/servers.sh restart
scripts/servers.sh stop
```

Syntax checks:

```bash
python3 -m py_compile proxy.py redmine_proxy.py backend/*.py
node --check app.js
```

## Making A Change

1. Edit the relevant files locally.
2. Run syntax checks.
3. Test locally with `scripts/servers.sh start`.
4. Confirm login and the affected view still work.
5. Create a clean zip, excluding local/tooling folders.
6. Upload the zip to the VM.
7. Replace `/opt/birdseye/app` with the new app files.
8. Restart `birdseye-backend` and reload Nginx.
9. Hard-refresh the browser or test in an incognito window.

## Packaging For Deployment

Run this from the parent folder of the project:

```bash
cd /Users/inosh/repos/codex

rm -f team-highlevel-view.zip

zip -r team-highlevel-view.zip team-highlevel-view \
  -x "team-highlevel-view/.git/*" \
  -x "team-highlevel-view/.venv/*" \
  -x "team-highlevel-view/.server/*" \
  -x "team-highlevel-view/.claude/*" \
  -x "team-highlevel-view/node_modules/*" \
  -x "team-highlevel-view/__pycache__/*" \
  -x "team-highlevel-view/backend/__pycache__/*" \
  -x "team-highlevel-view/outputs/*"


  
```

Important: exclude `.claude`. It may contain worktrees with their own
`requirements.txt`, which can confuse deployment scripts.

Upload:

```bash
scp -i inosh.pem team-highlevel-view.zip ec2-user@54.225.32.245:~/
```

## Deploying A New App Version

SSH to the VM:

```bash
ssh -i inosh.pem ec2-user@54.225.32.245
```

Replace only the app files:

```bash
sudo systemctl stop birdseye-backend

sudo rm -rf /tmp/birdseye-upload /opt/birdseye/app.prev
mkdir -p /tmp/birdseye-upload

unzip -q ~/team-highlevel-view.zip -d /tmp/birdseye-upload

APP_SRC=/tmp/birdseye-upload/team-highlevel-view
ls "$APP_SRC/index.html" "$APP_SRC/app.js" "$APP_SRC/proxy.py" "$APP_SRC/requirements.txt"

sudo cp -a /opt/birdseye/app /opt/birdseye/app.prev
sudo rm -rf /opt/birdseye/app
sudo mkdir -p /opt/birdseye/app

sudo cp -a "$APP_SRC"/. /opt/birdseye/app/
sudo cp /opt/birdseye/app.prev/config.local.js /opt/birdseye/app/config.local.js 2>/dev/null || true

sudo chown -R birdseye:birdseye /opt/birdseye/app
sudo find /opt/birdseye/app -type d -exec chmod 0755 {} \;
sudo find /opt/birdseye/app -type f -exec chmod 0644 {} \;

sudo /opt/birdseye/venv/bin/pip install -r /opt/birdseye/app/requirements.txt

sudo systemctl start birdseye-backend
sudo systemctl reload nginx
```

Verify:

```bash
grep -n "loginShell\|High-Level Planner" /opt/birdseye/app/index.html
sudo systemctl status birdseye-backend --no-pager
curl -Ik https://birdseye.entgra.net
```

Then hard-refresh Chrome:

```text
Cmd + Shift + R
```

## First-Time Server Setup

The first-time installer is stored outside the repo folder at:

```text
/Users/inosh/repos/codex/setup-birdseye-al2023.sh
```

Upload it with the app zip:

```bash
scp -i inosh.pem setup-birdseye-al2023.sh team-highlevel-view.zip ec2-user@54.225.32.245:~/
```

Run on the VM:

```bash
sudo APP_DOMAIN=birdseye.entgra.net \
  APP_ARCHIVE=team-highlevel-view.zip \
  REDMINE_URL=https://roadmap.entgra.net \
  CERTBOT_EMAIL=inosh@entgra.io \
  MYSQL_ADMIN_PASSWORD='mysql-root-password' \
  bash setup-birdseye-al2023.sh
```

The installer sets up packages, swap, MySQL, app DB/user, Python venv, systemd,
Nginx, and Certbot. It is safe to rerun if setup fails partway through.

## TLS Certificates

The current certificate was created using manual DNS validation because port 80
is blocked.

Manual issue/renew:

```bash
sudo certbot certonly --manual \
  --preferred-challenges dns \
  -d birdseye.entgra.net \
  -m inosh@entgra.io \
  --agree-tos \
  --no-eff-email
```

Certbot will ask for a TXT record:

```text
_acme-challenge.birdseye.entgra.net
```

Add/update that TXT record in GoDaddy. Before pressing Enter in Certbot, verify:

```bash
dig TXT _acme-challenge.birdseye.entgra.net +short
```

Install the cert into Nginx:

```bash
sudo certbot install --nginx -d birdseye.entgra.net
sudo systemctl reload nginx
```

The `certbot-renew.timer` may be enabled, but unattended renewal will fail for a
manual DNS certificate unless GoDaddy DNS API automation is added.

Check:

```bash
sudo certbot renew --dry-run
```

If it reports that `--manual-auth-hook` is required, renewal is not automated.

## GoDaddy Auto-Renewal Options

To auto-renew while port 80 remains blocked, use one of these:

1. GoDaddy DNS API with Certbot manual auth/cleanup hooks.
2. A third-party GoDaddy Certbot DNS plugin.
3. Delegate only `_acme-challenge.birdseye.entgra.net` to a DNS provider with
   a supported Certbot plugin, such as Route53 or Cloudflare.
4. Temporarily allow port 80 for HTTP-01 renewals.

If using GoDaddy API, confirm the account has access at:

```text
https://developer.godaddy.com/keys
```

Some GoDaddy accounts do not have DNS API access.

## Troubleshooting

Old UI appears after deployment:

```bash
grep -n "loginShell\|High-Level Planner\|Time Logs" /opt/birdseye/app/index.html
curl -s https://birdseye.entgra.net/index.html | grep -n "loginShell\|High-Level Planner\|Time Logs"
```

If `Time Logs` appears but `loginShell` does not, the deployed zip is old or the
wrong folder was copied.

Backend not starting:

```bash
sudo journalctl -u birdseye-backend -n 120 --no-pager
sudo systemctl status birdseye-backend --no-pager
```

Nginx config problem:

```bash
sudo nginx -t
sudo journalctl -u nginx -n 80 --no-pager
```

MySQL login/admin issue:

```bash
sudo grep -i 'temporary password' /var/log/mysqld.log
mysql -uroot -p
```

If the temporary password is stale, use the actual root password that can log in.

Certificate DNS issue:

```bash
dig A birdseye.entgra.net +short
dig TXT _acme-challenge.birdseye.entgra.net +short
```

Let's Encrypt must see the exact TXT value that Certbot generated for the
current attempt. Each retry generates a new value.

Check public HTTPS:

```bash
curl -Ik https://birdseye.entgra.net
```

## Backup Notes

AWS instance backup is configured outside the app every 12 hours. That is enough
for the current internal setup, but periodically test restore. Before risky
changes, take a quick MySQL dump as an extra safety point:

```bash
mysqldump -u root -p team_view > team_view_$(date +%F_%H%M).sql
```

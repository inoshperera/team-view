---
name: birdseye-tls-renewal
description: Renew and verify the Birdseye production TLS certificate for https://birdseye.entgra.net on the EC2 VM. Use when the user mentions expired certificates, Certbot, Let's Encrypt, GoDaddy DNS, _acme-challenge TXT records, nginx TLS, HTTPS failures, or asks to redo the Birdseye certificate renewal.
---

# Birdseye TLS Renewal

Use this skill to renew the Birdseye production certificate on the current
single-VM EC2 setup.

## Constants

- Repo: `/Users/inosh/repos/codex/team-highlevel-view`
- Runbook: `DEPLOYMENT.md`
- SSH key: `/Users/inosh/repos/codex/inosh.pem`
- Host: `ec2-user@54.225.32.245`
- Domain: `birdseye.entgra.net`
- Production URL: `https://birdseye.entgra.net`
- Certbot email: `inosh@entgra.io`
- ACME TXT name: `_acme-challenge.birdseye.entgra.net`

## Workflow

1. Read `DEPLOYMENT.md`, especially the TLS Certificates section.
2. Inspect current state before changing anything:
   - `curl -Ik https://birdseye.entgra.net`
   - `sudo certbot certificates`
   - `sudo systemctl status certbot-renew.timer certbot-renew.service --no-pager`
   - `sudo tail -n 220 /var/log/letsencrypt/letsencrypt.log`
   - `sudo nginx -t`
3. If Certbot is using `authenticator = manual`, expect unattended renewal to
   fail unless a `--manual-auth-hook` exists. This project currently uses manual
   GoDaddy DNS-01 validation because port 80 is blocked.
4. Start a fresh manual renewal in an interactive SSH session:

```bash
ssh -tt -i /Users/inosh/repos/codex/inosh.pem ec2-user@54.225.32.245 \
  "sudo certbot certonly --manual \
    --preferred-challenges dns \
    -d birdseye.entgra.net \
    -m inosh@entgra.io \
    --agree-tos \
    --no-eff-email \
    --force-renewal"
```

5. Give the user the fresh TXT value Certbot prints. Tell them to delete or
   replace stale `_acme-challenge.birdseye` TXT records in GoDaddy and add the
   new value.
6. Verify DNS from production before pressing Enter in Certbot:

```bash
ssh -i /Users/inosh/repos/codex/inosh.pem ec2-user@54.225.32.245 \
  "dig TXT _acme-challenge.birdseye.entgra.net +short"
```

Multiple TXT values are acceptable if the fresh value is present.

7. Continue Certbot by sending Enter to the interactive session.
8. Reload Nginx because it already points at the live Certbot paths:

```bash
ssh -i /Users/inosh/repos/codex/inosh.pem ec2-user@54.225.32.245 \
  "set -e; sudo nginx -t; sudo systemctl reload nginx; sudo certbot certificates; \
   echo | openssl s_client -servername birdseye.entgra.net -connect 127.0.0.1:443 2>/dev/null | openssl x509 -noout -subject -issuer -dates; \
   curl -Ik https://birdseye.entgra.net; \
   sudo systemctl is-active nginx birdseye-backend mysqld"
```

## Known Failure

The August 2026 expiry happened because the `certbot-renew.timer` ran
non-interactively against a manual DNS certificate. Certbot failed with:

```text
An authentication script must be provided with --manual-auth-hook when using the manual plugin non-interactively.
```

Manual renewal succeeded on 2026-08-24. The renewed certificate expires on
2026-11-22 04:50:59 UTC.

## Follow-Up

After renewal, remind the user that this certificate will not auto-renew until
DNS automation is added. Good options are GoDaddy DNS API hooks, a supported DNS
plugin via delegated `_acme-challenge`, or temporarily enabling HTTP-01 on port
80.

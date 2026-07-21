# Deployment Runbook — Self-hosting Scenes on a domain

> Goal of this phase: prove the whole self-hosted path works end to end — server → Coolify → Docker build → domain → HTTPS — **before** writing any feature code.
> Target state: `https://scenes.<yourdomain>` serves the Next.js app, backed by a self-hosted Postgres, with the worker running alongside.

## 0. What you need before starting

- A domain name (any registrar — OVH/Gandi if you want French, Cloudflare/Porkbun if you want cheap + good DNS).
- A Hetzner Cloud account.
- An SSH key on your machine (`ssh-keygen -t ed25519` if you don't have one).
- The repo pushed to GitHub (Coolify deploys from git).

Budget: ~€7–16/month for the server, ~€10–15/year for the domain.

## 1. Provision the server (Hetzner)

Hetzner Cloud → new project → **Add Server**:

| Setting | Value |
|---|---|
| Location | Falkenstein or Nuremberg (DE) — closest EU latency to Paris; Hetzner has no FR region |
| Image | **Ubuntu 24.04 LTS** (Coolify requires LTS; non-LTS needs manual install) |
| Type | **CX32** (4 vCPU / 8 GB / 80 GB) recommended. CX22 (2 vCPU / 4 GB) works but is tight — Coolify alone eats ~1 GB RAM |
| SSH key | add yours (disable password auth) |
| Firewall | create one: allow **22, 80, 443** only |

Note the public IPv4.

> Sizing rationale: Coolify's official minimum is 2 CPU / 2 GB / 30 GB, but that leaves no headroom once you run the app + worker + Postgres. 4 vCPU / 8 GB is the comfortable sweet spot and still ~€7–8/mo at Hetzner.

## 2. Point the domain at the server

At your DNS provider, create:

```
A    scenes        <SERVER_IPv4>      TTL 300
A    coolify       <SERVER_IPv4>      TTL 300     # admin UI on its own subdomain
```

(Or use the apex `@` for the app if you prefer `https://yourdomain.fr`.)

Verify propagation before continuing:

```bash
dig +short scenes.yourdomain.fr
```

If you use Cloudflare DNS, set these records to **DNS only (grey cloud)** for the initial Let's Encrypt issuance — you can enable the proxy afterwards.

## 3. Harden the server (5 minutes, worth it)

```bash
ssh root@<SERVER_IPv4>
apt update && apt upgrade -y
# unattended security upgrades
apt install -y unattended-upgrades && dpkg-reconfigure -plow unattended-upgrades
# basic firewall (in addition to Hetzner's)
ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw --force enable
```

Disable SSH password login in `/etc/ssh/sshd_config` (`PasswordAuthentication no`), then `systemctl restart ssh`.

## 4. Install Coolify

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

It installs Docker and the Coolify stack. When it finishes, open `http://<SERVER_IPv4>:8000` and create the admin account **immediately** (first account wins — don't leave it open).

Then in Coolify: **Settings → Instance Domain** → set `https://coolify.yourdomain.fr`. Coolify will issue a Let's Encrypt cert for its own UI and stop serving on the raw IP.

> Alternative: [Dokploy](https://dokploy.com) is a lighter equivalent with the same model. Coolify chosen here for the larger community and more mature backups/DB management.

## 5. Connect GitHub

Coolify → **Sources → GitHub App** → install the app on the `scenes_project` repo (or the standalone V1 repo). This gives Coolify pull access plus automatic deploys on push.

## 6. Create the Postgres resource

Coolify → your project → **+ New → Database → PostgreSQL 17**.

- Note the generated credentials.
- Keep it **internal only** (do not expose a public port) — the app reaches it over Coolify's internal Docker network.
- Enable **scheduled backups** (Settings → Backups): daily, retained ~7 days, ideally to S3/MinIO or Hetzner Storage Box.

Coolify gives you an internal connection string like:
`postgres://postgres:<pw>@<service-name>:5432/postgres` — this is your `DATABASE_URL`.

## 7. Deploy the web app

Coolify → **+ New → Application → from your GitHub repo**.

| Setting | Value |
|---|---|
| Build Pack | **Dockerfile** |
| Dockerfile location | `scenes_V1/apps/web/Dockerfile` (adjust if the repo root is `scenes_V1`) |
| Base directory / build context | repo root containing `package.json` workspaces (`scenes_V1/`) |
| Port | `3000` |
| Domain | `https://scenes.yourdomain.fr` |

Environment variables:

```
DATABASE_URL=postgres://postgres:<pw>@<pg-service>:5432/postgres
BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=https://scenes.yourdomain.fr
RESEND_API_KEY=<later>
NODE_ENV=production
```

Deploy. Coolify builds the image, runs it behind its Traefik proxy, and requests a Let's Encrypt cert automatically.

**Success criteria for this phase:** `https://scenes.yourdomain.fr` loads the "Scenes — V1" page over valid HTTPS, and a `git push` to `main` triggers an automatic redeploy.

## 8. Deploy the worker

Same flow, **+ New → Application**, but:

- Dockerfile location: `apps/worker/Dockerfile`
- **No domain, no port** (it's not a web service)
- Env: `DATABASE_URL` only (plus feed keys later)

The worker's `node-cron` schedule handles the daily 05:00 run. (Alternative: deploy it as a Coolify **Scheduled Task** instead of a long-running container — decide once the first ingester is real.)

## 9. Run the migrations

Until there's a migration step in CI, run once from your machine against the server DB, or via Coolify's terminal into the app container:

```bash
npm run db:migrate
```

Later: add migrations to the web app's start command or a Coolify pre-deploy command.

## 10. Post-deploy checklist

- [ ] `https://scenes.yourdomain.fr` serves over HTTPS, cert valid
- [ ] HTTP redirects to HTTPS
- [ ] Push to `main` → auto-redeploy works
- [ ] Postgres is **not** publicly reachable (`nmap -p 5432 <IP>` shows closed/filtered)
- [ ] Daily DB backups configured **and a restore tested once**
- [ ] Coolify admin UI on its own domain, strong password, 2FA enabled
- [ ] Server firewall: only 22/80/443 open
- [ ] Uptime monitoring on the public URL (UptimeRobot/BetterStack free tier)

## Known gotchas

- **Monorepo Docker context.** The Dockerfiles build from the repo root (they copy `packages/db`). If Coolify's build context is set to `apps/web`, the build fails — set the base directory to the workspace root.
- **Cloudflare proxy + Let's Encrypt.** Issue the cert with the proxy off, then turn it on; otherwise the HTTP-01 challenge can fail.
- **Disk fill from Docker images.** Coolify prunes, but check `docker system df` occasionally; set up a cleanup schedule in Coolify settings.
- **Single point of failure.** One VPS = no HA. Fine for V1; the backup/restore drill is what actually protects you.
- **GDPR/data location.** Hetzner DE is EU — fine. If data sovereignty becomes a selling point with venues, OVH/Scaleway FR is the swap, and nothing in this setup is provider-specific.

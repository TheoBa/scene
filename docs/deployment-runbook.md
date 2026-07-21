# Deployment Runbook — Self-hosting Scenes

> Goal of this phase: prove the whole self-hosted path works end to end — host → Coolify → Docker build → domain → HTTPS — **before** writing any feature code.

## Two tracks

| | **Track A — Staging (now)** | **Track B — Production (before launch)** |
|---|---|---|
| Host | Personal Mac Mini (Apple Silicon), Ubuntu 24.04 VM | Hetzner CX32, Ubuntu 24.04 |
| Domain | `scenes.badoz.org` | brand domain, TBD |
| Exposure | Cloudflare Tunnel | Direct, ports 80/443 |
| TLS | Cloudflare edge | Let's Encrypt via Coolify |
| Cost | €0 | ~€8/mo |

**Do Track A now.** It validates the entire pipeline for free and remains useful as staging forever. Track B is the same Coolify setup on a rented Linux box — deliberately kept near-identical so migration is a re-deploy, not a rewrite.

**Don't launch publicly on `badoz.org`.** It's a personal domain; SEO authority and brand equity accrue to the domain that serves the product, and piece pages are your main acquisition channel. Staging only.

---

# Track A — Mac Mini + Cloudflare Tunnel

## A1. Why a Linux VM, not macOS directly

Coolify requires a Linux host with native Docker; it does not run on macOS. Docker Desktop on a Mac is itself a Linux VM, so running Ubuntu explicitly costs little and keeps this setup identical to the eventual Hetzner one.

**Recommended:** [UTM](https://mac.getutm.app) (free, Apple Virtualization framework) or VMware Fusion (free for personal use). OrbStack is excellent for plain Docker but nesting Coolify inside it is awkward.

VM specs: **4 CPU / 8 GB RAM / 80 GB disk**, Ubuntu Server 24.04 LTS **arm64**, network mode **Bridged** (gives the VM its own LAN IP).

## A2. Prepare macOS to act as a server

```bash
# Never sleep (a sleeping host = a dead site)
sudo pmset -a sleep 0 disablesleep 1 displaysleep 15
# Restart automatically after a power cut
sudo pmset -a autorestart 1
```

Also: System Settings → Energy → "Start up automatically after a power failure", disable automatic macOS updates that force reboots, and set UTM to auto-start the VM at login.

## A3. Install Ubuntu + Coolify in the VM

Install Ubuntu Server 24.04 LTS (arm64), then inside the VM:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y unattended-upgrades
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Coolify supports arm64, so the Apple Silicon architecture is fine. Note the VM's LAN IP (`ip a`) — call it `<VM_IP>`.

Open `http://<VM_IP>:8000` from your Mac and **create the admin account immediately** (first account wins).

> **arm64 note.** Images built here are arm64; Hetzner is x86_64. This is a non-issue because Coolify builds from source on each host — just never push an arm64 image to a registry and expect it to run on Track B. Our base images (`node:22-alpine`, `postgres:17-alpine`) are multi-arch.

## A4. Cloudflare Tunnel

Install `cloudflared` **inside the VM** (so it can reach services on localhost):

```bash
# arm64 Ubuntu
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

cloudflared tunnel login          # opens a browser; authorize badoz.org
cloudflared tunnel create scenes  # note the tunnel UUID
```

Create `/etc/cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_UUID>
credentials-file: /root/.cloudflared/<TUNNEL_UUID>.json

ingress:
  - hostname: scenes.badoz.org
    service: http://localhost:80      # Coolify's Traefik proxy
  - hostname: coolify.badoz.org
    service: http://localhost:8000    # Coolify admin UI
  - service: http_status:404
```

Route DNS and run it as a service:

```bash
cloudflared tunnel route dns scenes scenes.badoz.org
cloudflared tunnel route dns scenes coolify.badoz.org
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

Cloudflare creates the CNAME records automatically. In the Cloudflare dashboard set **SSL/TLS mode → Full**.

> **Critical gotcha:** with a tunnel there is no inbound port 80, so Let's Encrypt's HTTP-01 challenge **will fail**. In Coolify, set each app's domain as `http://scenes.badoz.org` (not `https://`) and leave automatic HTTPS **off** — Cloudflare provides the public certificate. The tunnel itself is encrypted, so nothing is exposed in the clear.

Consider protecting `coolify.badoz.org` with a Cloudflare Access policy (free) so the admin UI isn't publicly reachable at all.

## A5. Deploy the stack in Coolify

Identical to Track B — see the shared section below.

## A6. Track A limitations (accept them knowingly)

Single machine, home internet, no HA — a power cut or ISP outage takes the site down. Fine for pre-launch, unacceptable once users exist. Home upload bandwidth caps throughput. Your Mac Mini becomes a production dependency, so don't casually reboot it. And your prod database would live on a personal machine — another reason this is staging, not production.

---

# Track B — Hetzner (production, later)

Same Coolify setup, differences only:

1. **Server:** Hetzner Cloud → Ubuntu 24.04 LTS, type **CX32** (4 vCPU / 8 GB / 80 GB), location Falkenstein or Nuremberg (EU/GDPR fine; Hetzner has no FR region). Add your SSH key; firewall allowing **22, 80, 443** only.
2. **Harden:** `ufw allow 22 80 443 && ufw --force enable`, `PasswordAuthentication no` in `/etc/ssh/sshd_config`, unattended-upgrades on.
3. **DNS:** A records for the brand domain → server IPv4. Grey-cloud (DNS only) in Cloudflare during first cert issuance, then proxy on if wanted.
4. **TLS:** no tunnel — set domains as `https://` in Coolify and let Let's Encrypt issue normally.
5. Everything else below is unchanged.

> Sizing: Coolify's official minimum is 2 CPU / 2 GB / 30 GB, but Coolify alone uses ~1 GB RAM. 4 vCPU / 8 GB is the comfortable point once you run app + worker + Postgres.

---

# Shared — deploying the stack in Coolify

## S1. Connect GitHub

Coolify → **Sources → GitHub App** → install on the repo. Enables pull access and auto-deploy on push.

## S2. Postgres

**+ New → Database → PostgreSQL 17**. Keep it **internal only** (no public port). Enable **scheduled backups**: daily, ~7-day retention, off-box destination. Note the internal connection string — that's your `DATABASE_URL`.

## S3. Web app

**+ New → Application → from GitHub repo**, Build Pack = **Dockerfile**.

| Setting | Value |
|---|---|
| Base directory / build context | the workspace root containing `package.json` (`scenes_V1/`) |
| Dockerfile | `apps/web/Dockerfile` |
| Port | `3000` |
| Domain | Track A: `http://scenes.badoz.org` · Track B: `https://<brand-domain>` |

Environment:

```
DATABASE_URL=postgres://postgres:<pw>@<pg-service>:5432/postgres
BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=https://scenes.badoz.org      # always https — it's the public URL
RESEND_API_KEY=<later>
NODE_ENV=production
```

## S4. Worker

Same flow, Dockerfile `apps/worker/Dockerfile`, **no domain and no port** (not a web service). Env: `DATABASE_URL` plus feed keys later.

## S5. Migrations

Run once against the target DB, from Coolify's container terminal or your machine:

```bash
npm run db:migrate
```

Later: promote this to a pre-deploy command in Coolify.

---

## Phase-0 exit checklist

- [ ] `https://scenes.badoz.org` serves the V1 page over valid HTTPS
- [ ] HTTP redirects to HTTPS
- [ ] Push to `main` → automatic redeploy
- [ ] Postgres not reachable from outside the host
- [ ] Daily DB backups configured **and a restore tested once**
- [ ] Coolify admin not publicly open (Cloudflare Access or IP restriction), strong password, 2FA
- [ ] Mac Mini: sleep disabled, auto-restart after power failure, VM auto-starts
- [ ] `cloudflared` running as a systemd service and surviving a VM reboot
- [ ] Uptime monitoring on the public URL (UptimeRobot / BetterStack free tier)

## Known gotchas

- **Monorepo Docker context.** The Dockerfiles copy `packages/db`, so they must build from the workspace root. Pointing Coolify's build context at `apps/web` will fail.
- **Let's Encrypt vs. Cloudflare Tunnel.** Covered above: HTTP-01 can't work through a tunnel. Use `http://` domains in Coolify on Track A.
- **Proxy headers.** Behind Cloudflare + Traefik, ensure the app reads `X-Forwarded-Proto`/`Host` correctly so auth callbacks and canonical URLs use `https://scenes.badoz.org`, not the internal address.
- **Mac sleep.** The single most likely cause of mystery downtime on Track A. Verify with `pmset -g`.
- **Disk fill.** Check `docker system df` periodically; enable Coolify's cleanup schedule.
- **arm64 vs x86_64.** Build on the host, don't ship images between tracks.

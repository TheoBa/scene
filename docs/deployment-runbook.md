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

**Tool: [Lima](https://lima-vm.io) (`limactl`).** Entirely CLI-driven — no GUI, no ISO, no installer wizard — and it uses Apple's Virtualization framework natively on Apple Silicon. This whole runbook is executable over SSH.

> Rejected: UTM and VMware Fusion (GUI-first VM creation). OrbStack is great for plain Docker but nesting Coolify inside it isn't supported.

**Networking note:** Lima uses user-mode networking and auto-forwards the guest's listening ports to `127.0.0.1` on the Mac. No bridged interface, no router config, no LAN IP needed — and since `cloudflared` runs *inside* the VM and dials outbound, nothing needs inbound access at all.

## A2. Prepare macOS to act as a server (all CLI)

```bash
# Never sleep — a sleeping host is a dead site
sudo pmset -a sleep 0 disablesleep 1 displaysleep 15

# Come back up automatically after a power cut
sudo pmset -a autorestart 1
sudo systemsetup -setrestartpowerfailure on

# Verify
pmset -g | grep -E 'sleep|autorestart'
```

**Check FileVault** — this is the classic headless-Mac trap. With FileVault on, the Mac will *not* finish booting unattended after a power loss; it waits at the unlock screen and your site stays down.

```bash
fdesetup status
```

If it says enabled, either disable it (`sudo fdesetup disable`) or accept that unattended reboots need manual intervention. For a staging box holding no real user data, disabling is reasonable.

Finally, stop macOS from rebooting itself for updates:

```bash
sudo softwareupdate --schedule off
```

## A3. Create the Ubuntu VM

> ⚠️ Everything from A3.4 onward runs **inside the Ubuntu guest**, not in macOS Terminal.
> If your prompt looks like `theobadoz@Mac ~ %` you are on the host and `apt` will not exist.
> Inside the VM the prompt looks like `theo@scenes-vm:~$`.

### A3.1 Install Lima and create the VM

On the Mac (over SSH is fine):

```bash
brew install lima

limactl create --name=scenes-vm \
  --cpus=4 --memory=8 --disk=80 \
  template://ubuntu-24.04

limactl start scenes-vm
```

Lima downloads an Ubuntu 24.04 arm64 cloud image and boots it headless in under a minute. No ISO, no installer, SSH already configured.

> Older Lima versions don't have `limactl create`; use a single command instead:
> `limactl start --name=scenes-vm --cpus=4 --memory=8 --disk=80 template://ubuntu-24.04`

Check it's running:

```bash
limactl list
```

### A3.2 Enter the VM

```bash
limactl shell scenes-vm
```

Confirm you're actually in Linux before continuing:

```bash
cat /etc/os-release     # should say Ubuntu 24.04
```

> `limactl shell` drops you straight in. If you prefer plain SSH, `limactl show-ssh scenes-vm` prints the exact command and port.

### A3.3 Auto-start the VM at boot

Lima won't restart the VM after a reboot on its own. Create a LaunchDaemon (runs at boot, before any login — important for a headless machine). On the **Mac**:

```bash
sudo tee /Library/LaunchDaemons/io.lima.scenes-vm.plist >/dev/null <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>io.lima.scenes-vm</string>
  <key>UserName</key><string>REPLACE_WITH_YOUR_MAC_USERNAME</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><false/>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/limactl</string>
    <string>start</string>
    <string>scenes-vm</string>
  </array>
  <key>StandardOutPath</key><string>/tmp/lima-scenes-vm.log</string>
  <key>StandardErrorPath</key><string>/tmp/lima-scenes-vm.err</string>
</dict>
</plist>
EOF

# set your username, then load it
sudo sed -i '' "s/REPLACE_WITH_YOUR_MAC_USERNAME/$(whoami)/" /Library/LaunchDaemons/io.lima.scenes-vm.plist
sudo launchctl load /Library/LaunchDaemons/io.lima.scenes-vm.plist
```

Test it properly by rebooting the Mac and confirming `limactl list` shows the VM running without you touching anything.

### A3.4 Install Coolify inside the VM

Now install Coolify **inside the VM**:

```bash
cd ~                              # not the mounted /Users/... macOS path
sudo apt update && sudo apt upgrade -y
sudo apt install -y unattended-upgrades
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
```

> **`sudo bash`, not `bash`.** The installer needs root — it installs Docker first. On a Hetzner box you're already root and plain `bash` works; in Lima you're a normal user, and without `sudo` the script exits early, leaving you with `docker: command not found`.

> **Work from `~`, not the mounted macOS directory.** Lima mounts your Mac home into the guest. Running installs there is slow (virtiofs) and can hit permission oddities. `cd ~` puts you on the guest's own disk.

Coolify supports arm64, so Apple Silicon is fine. First run takes several minutes while it installs Docker and pulls images.

Verify before moving on:

```bash
sudo docker ps                    # several coolify containers
curl -I http://localhost:8000     # should return HTTP headers
```

**Reaching the Coolify UI without a GUI on the Mac.** Lima forwards the guest's port 8000 to `127.0.0.1:8000` on the Mac. From your laptop, tunnel it over your existing SSH connection:

```bash
ssh -L 8000:127.0.0.1:8000 <you>@<mac-mini>
```

Then open `http://localhost:8000` in your laptop's browser and **create the admin account immediately** (first account wins). After A4, Coolify is also reachable at `https://coolify.badoz.org`.

> **arm64 note.** Images built here are arm64; Hetzner is x86_64. This is a non-issue because Coolify builds from source on each host — just never push an arm64 image to a registry and expect it to run on Track B. Our base images (`node:22-alpine`, `postgres:17-alpine`) are multi-arch.

#### Troubleshooting: `channel N: open failed: connect failed: Connection refused`

That message on the Mac Mini's terminal means the SSH tunnel is healthy but **nothing is listening on the Mac's `127.0.0.1:8000`**. Diagnose top-down.

On the Mac:

```bash
limactl list                      # STATUS must be Running
curl -I http://127.0.0.1:8000     # refused → not forwarded to the host
```

Inside the guest (`limactl shell scenes-vm`):

```bash
sudo docker ps                    # expect several coolify containers
curl -I http://localhost:8000     # does Coolify answer locally?
sudo ss -tlnp | grep 8000         # what is bound, and on which address
```

**Case 1 — `docker: command not found`, or no/few containers.** The install didn't finish. Most common cause: the script was run without `sudo`, so it exited before installing Docker. Re-run `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash` from `~` and read the output. If Docker *is* installed but containers are still starting, just wait — the first image pull takes several minutes.

**Case 2 — Coolify answers in the guest but the Mac refuses.** Lima port forwarding. Lima only auto-forwards ports the guest binds on `0.0.0.0`; anything bound to the guest's loopback stays invisible. Declare it explicitly:

```bash
limactl stop scenes-vm
limactl edit scenes-vm
```

```yaml
portForwards:
  - guestPort: 8000
    hostIP: "127.0.0.1"
    hostPort: 8000
```

```bash
limactl start scenes-vm
```

**Case 3 — bypass host forwarding entirely.** Tunnel from inside the guest by jumping through the Mac. Get the Lima SSH port with `limactl show-ssh scenes-vm`, then from your laptop:

```bash
ssh -J <you>@<mac-mini> -p <LIMA_PORT> <lima-user>@127.0.0.1 -L 8000:localhost:8000
```

Once A4 is done this is all moot — `https://coolify.badoz.org` works over the tunnel and no SSH forwarding is needed.

## A4. Cloudflare Tunnel

Install `cloudflared` **inside the VM** (so it can reach services on localhost):

```bash
# arm64 Ubuntu
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

cloudflared tunnel login          # prints a URL — open it on your laptop, authorize badoz.org
cloudflared tunnel create scenes  # note the tunnel UUID
```

> Headless note: `cloudflared tunnel login` can't open a browser on the VM. It prints a URL to the terminal — copy it to your laptop's browser, authorize `badoz.org`, and the cert lands back on the VM automatically.

Route the DNS records:

```bash
cloudflared tunnel route dns scenes scenes.badoz.org
cloudflared tunnel route dns scenes coolify.badoz.org
```

Now write the config **where root can find it**. `cloudflared tunnel login` stores credentials under *your* home (`~/.cloudflared/`), but the service runs as root and only searches `/root/.cloudflared` and `/etc/cloudflared` — so copy the credentials into `/etc/cloudflared` and reference them there:

```bash
TUNNEL_ID=<TUNNEL_UUID>            # printed by `cloudflared tunnel create`

ls ~/.cloudflared/                 # confirm ${TUNNEL_ID}.json exists
sudo mkdir -p /etc/cloudflared
sudo cp ~/.cloudflared/${TUNNEL_ID}.json /etc/cloudflared/

sudo tee /etc/cloudflared/config.yml >/dev/null <<EOF
tunnel: ${TUNNEL_ID}
credentials-file: /etc/cloudflared/${TUNNEL_ID}.json

ingress:
  - hostname: scenes.badoz.org
    service: http://localhost:80      # Coolify's Traefik proxy
  - hostname: coolify.badoz.org
    service: http://localhost:8000    # Coolify admin UI
  - service: http_status:404
EOF
```

> **Why this order matters.** `cloudflared service install` reads the config at install time. Run it before the config exists and it fails with
> `Cannot determine default configuration path` followed by `Unit file cloudflared.service does not exist`.

Install and start the service:

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared --no-pager
journalctl -u cloudflared -f          # watch it connect
```

Cloudflare creates the CNAME records automatically. In the Cloudflare dashboard set **SSL/TLS mode → Full**.

Verify from your laptop: `https://coolify.badoz.org` should load the Coolify UI — this replaces the SSH port-forward permanently. `https://scenes.badoz.org` will return a Traefik **404 until the web app is deployed with that domain attached** (section S3); that's expected, not a fault.

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

> **Coolify's structure:** resources live inside **Project → Environment → Resource**. There is no "add database" button at the top level — create the project first. All three resources (Postgres, web, worker) must go in the **same project and environment**, or the internal hostnames won't resolve between them.

1. Sidebar → **Projects** → **+ Add**. Name it `scenes`. Coolify creates a default **production** environment.
2. Open the project → **production** environment → **+ New** / **Add Resource**.
3. Category **Databases** → **PostgreSQL** (version **17** if offered).
4. Target server: the one Coolify runs on, usually labelled `localhost`.
5. Credentials are generated for you. Leave **"Make it publicly available"** / public port **off** — the app connects over the internal Docker network.
6. Click **Deploy** / **Start**. Creating the resource does *not* start the container — this step is easy to miss.

Then copy the **internal** connection string from the resource page (`postgres://postgres:<pw>@<service-name>:5432/postgres`) — that's your `DATABASE_URL`.

**Backups:** on the database resource → **Backups** tab → add a daily scheduled backup, ~7-day retention. Point it at S3-compatible storage rather than local disk when you can; a backup on the same disk as the database protects against very little. Whatever you configure, **restore it once** before trusting it.

## S3. Web app

In the **same project and environment** as the database: **+ New → Application → from GitHub repo**, Build Pack = **Dockerfile**.

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
- [ ] Mac Mini: sleep disabled, auto-restart after power failure, FileVault checked
- [ ] Lima VM auto-starts after a Mac reboot (LaunchDaemon tested with a real reboot)
- [ ] `cloudflared` running as a systemd service and surviving a VM reboot
- [ ] Uptime monitoring on the public URL (UptimeRobot / BetterStack free tier)

## Known gotchas

- **Monorepo Docker context.** The Dockerfiles copy `packages/db`, so they must build from the workspace root. Pointing Coolify's build context at `apps/web` will fail.
- **Let's Encrypt vs. Cloudflare Tunnel.** Covered above: HTTP-01 can't work through a tunnel. Use `http://` domains in Coolify on Track A.
- **Proxy headers.** Behind Cloudflare + Traefik, ensure the app reads `X-Forwarded-Proto`/`Host` correctly so auth callbacks and canonical URLs use `https://scenes.badoz.org`, not the internal address.
- **Running VM commands on the host.** `sudo: apt: command not found` plus `grep: /etc/os-release: No such file or directory` means you're in macOS, not the guest. Check the prompt: `%` and `@Mac` = host (zsh); `$` and `@lima-scenes-vm` = guest. Only A1–A2 and A3.1/A3.3 run on macOS; `limactl shell scenes-vm` gets you into the guest.
- **FileVault blocks unattended reboots.** The most likely reason a headless Mac never comes back after a power cut. Check `fdesetup status`.
- **`cloudflared service install` can't find the config.** `Cannot determine default configuration path` → `Unit file cloudflared.service does not exist`. The config must exist at `/etc/cloudflared/config.yml` *before* installing the service, and the credentials JSON must be somewhere root can read (`/etc/cloudflared/`, not your user's `~/.cloudflared/`).
- **Mac sleep.** The single most likely cause of mystery downtime on Track A. Verify with `pmset -g`.
- **Disk fill.** Check `docker system df` periodically; enable Coolify's cleanup schedule.
- **arm64 vs x86_64.** Build on the host, don't ship images between tracks.

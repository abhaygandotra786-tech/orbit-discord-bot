# Deploying Orbit to Oracle Cloud (Always Free) — Full Runbook

Everything from a fresh Oracle account to a live, 24/7 bot. Steps marked
**[you, in browser]** can only be done by you in your Oracle account; the
rest is copy-paste into the server terminal.

---

## Phase 1 — Oracle account & VM  **[you, in browser]**

1. Sign up at https://www.oracle.com/cloud/free/ (card needed for ID only).
   Pick your **Home Region** carefully — it's permanent.
2. Console → **Compute → Instances → Create Instance**.
   - Image: **Ubuntu 22.04**
   - Shape: **Ampere → VM.Standard.A1.Flex** → 2 OCPU / 12 GB (Always Free)
   - Networking: **Create new VCN**, **Assign public IPv4 = Yes**
   - SSH keys: paste your public key (Phase 2)
3. After it shows **Running**, copy the **Public IP**.
4. Open ports: **Networking → your VCN → Subnet → Default Security List →
   Add Ingress Rules** for TCP `22`, `80`, `443`, and `3000` (source `0.0.0.0/0`).

## Phase 2 — SSH key  **[your local machine]**

```bash
ssh-keygen -t ed25519 -C "orbit" -f ~/.ssh/orbit_key
cat ~/.ssh/orbit_key.pub      # paste this into Oracle's "Add SSH keys"
```

Connect:
```bash
ssh -i ~/.ssh/orbit_key ubuntu@<PUBLIC_IP>
```

## Phase 3 — One-time server hardening  **[on the server]**

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ufw fail2ban
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp
sudo ufw --force enable
sudo systemctl enable --now fail2ban

# disable root + password SSH login
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart ssh

# (recommended) 2 GB swap so the bot never gets OOM-killed
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Phase 4 — Get the code on the server  **[on the server]**

```bash
cd ~
git clone https://github.com/<you>/<your-repo>.git app
cd app
```
No GitHub repo? From your **local** machine instead:
```bash
rsync -avz -e "ssh -i ~/.ssh/orbit_key" --exclude node_modules --exclude .git \
  ./discord-bot/ ubuntu@<PUBLIC_IP>:~/app/
```

## Phase 5 — Launch  **[on the server]**

```bash
cd ~/app
chmod +x deploy.sh update.sh
./deploy.sh
```
On first run it creates a `.env` template and stops. Fill it in:
```bash
nano .env     # set TOKEN, CLIENT_ID, GUILD_ID, CLIENT_SECRET, SESSION_SECRET,
              # and WEB_BASE_URL / OAUTH_REDIRECT_URI = http://<PUBLIC_IP>:3000...
```
Then run it again — this installs everything, deploys commands, and starts
both processes under PM2 with boot-start enabled:
```bash
./deploy.sh
```

## Phase 6 — Verify

```bash
pm2 list                 # orbit + orbit-web should be "online"
pm2 logs orbit           # should show "orbit#xxxx is online! Serving Orbit."
```
Website: `http://<PUBLIC_IP>:3000`
Discord: add the redirect `http://<PUBLIC_IP>:3000/auth/callback` in the
Developer Portal → OAuth2 → Redirects.

## Going forward — updates

```bash
cd ~/app && ./update.sh
```

---

### Quick command reference
```bash
pm2 list                 # status
pm2 logs orbit           # bot logs
pm2 logs orbit-web       # site logs
pm2 restart all          # restart everything
pm2 reload all           # zero-downtime restart
./update.sh              # pull + reinstall + reload
htop; free -h; df -h     # resource usage
```

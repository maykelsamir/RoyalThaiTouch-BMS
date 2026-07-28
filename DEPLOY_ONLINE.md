# Royal Thai Touch BMS - Online Deployment

## 1) Prepare a VPS
Recommended starting server:
- Ubuntu 22.04 or 24.04
- 4 vCPU
- 8 GB RAM
- 80+ GB SSD

## 2) Install Docker on the VPS
```bash
sudo apt update
sudo apt install -y ca-certificates curl git ufw
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Log out and log in again after this command.

## 3) Open firewall
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

## 4) Clone the project
```bash
git clone -b rtt-erp-v07 https://github.com/maykelsamir/RoyalThaiTouch-BMS.git
cd RoyalThaiTouch-BMS
```

## 5) Create production environment
```bash
cp .env.production.example .env
nano .env
```

Change `POSTGRES_PASSWORD` to a strong password.

## 6) Start online production version
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Now open:

```text
http://SERVER_IP
```

## 7) Domain setup
In your domain DNS panel, add:

```text
A record
Name: erp
Value: YOUR_SERVER_IP
```

Then open:

```text
http://erp.yourdomain.com
```

## 8) HTTPS / SSL
For HTTPS, the easiest next step is to put Cloudflare in front of the domain and enable SSL, or add a Caddy/Certbot reverse proxy. Do this after confirming the app works on HTTP.

## 9) Update the online app later
```bash
cd RoyalThaiTouch-BMS
git pull origin rtt-erp-v07
docker compose -f docker-compose.prod.yml up -d --build
```

## 10) Backup database manually
```bash
docker exec rtt_db_prod pg_dump -U rtt_admin royalthaitouch > rtt_backup_$(date +%F).sql
```

Keep backups outside the server too.

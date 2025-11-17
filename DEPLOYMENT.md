# DropMate Backend - Digital Ocean Deployment Guide

## Option 1: App Platform (Recommended - Easiest)

### Prerequisites
- ✅ Digital Ocean account
- ✅ GitHub repository (already set up: `kevinlin29/dropmate-backend`)
- ✅ Firebase Admin SDK credentials

### Step 1: Deploy via App Platform

#### Method A: Using the DO Console (Easiest)

1. **Go to App Platform**
   - Log in to [DigitalOcean](https://cloud.digitalocean.com)
   - Click "Apps" in the left sidebar
   - Click "Create App"

2. **Connect GitHub Repository**
   - Select "GitHub" as source
   - Authorize DigitalOcean to access your GitHub
   - Select repository: `kevinlin29/dropmate-backend`
   - Select branch: `main`
   - Enable "Autodeploy" (deploys on every push)

3. **Configure Services**
   - DO will auto-detect your Dockerfiles
   - It should detect 3 services (core-api, location-service, notification-service)
   - Configure each service:
     - **core-api**: HTTP port 8080, make it publicly accessible
     - **location-service**: HTTP port 8081, internal only
     - **notification-service**: HTTP port 8082, publicly accessible for WebSocket

4. **Add Database**
   - Click "Add Resource" → "Database"
   - Select "PostgreSQL 16"
   - Choose "Dev Database" (cheaper) or "Production"
   - Name: `dropmate-db`
   - It will automatically set `DATABASE_URL` for your services

5. **Add Redis** (Optional - DO App Platform doesn't have managed Redis)
   - You'll need to either:
     - Use a DigitalOcean Managed Redis separately
     - Or skip Redis for now (location service won't work)

6. **Set Environment Variables**

   For **core-api**, add these encrypted environment variables:
   ```
   PORT=8080
   NODE_ENV=production
   JWT_SECRET=<your-secret-key>
   FIREBASE_PROJECT_ID=dropmate-9dc10
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@dropmate-9dc10.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY=<paste-your-private-key>
   ```

   For **location-service**:
   ```
   PORT=8081
   NODE_ENV=production
   ```

   For **notification-service**:
   ```
   PORT=8082
   NODE_ENV=production
   CORS_ORIGIN=*
   ```

7. **Deploy**
   - Review your configuration
   - Click "Create Resources"
   - Wait 5-10 minutes for deployment

8. **Initialize Database**
   - Once deployed, get the database connection string
   - Connect via `psql` or pgAdmin
   - Run the schema files in order:
     ```bash
     psql $DATABASE_URL -f schema/01_init_schema.sql
     psql $DATABASE_URL -f schema/02_firebase_auth.sql
     psql $DATABASE_URL -f schema/08_partitioning.sql
     ```

#### Method B: Using doctl CLI + app.yaml

We've created an `app.yaml` config file for you in `.do/app.yaml`.

1. **Install doctl**
   ```bash
   # Mac
   brew install doctl

   # Linux
   cd ~
   wget https://github.com/digitalocean/doctl/releases/download/v1.104.0/doctl-1.104.0-linux-amd64.tar.gz
   tar xf doctl-1.104.0-linux-amd64.tar.gz
   sudo mv doctl /usr/local/bin
   ```

2. **Authenticate**
   ```bash
   doctl auth init
   # Enter your DO API token (create one in API settings)
   ```

3. **Create App from Spec**
   ```bash
   doctl apps create --spec .do/app.yaml
   ```

4. **Set Secrets**
   ```bash
   # Get your app ID
   doctl apps list

   # Set encrypted environment variables
   doctl apps update <app-id> --spec .do/app.yaml
   ```

---

## Option 2: Droplet with Docker Compose (More Control)

This option gives you full control and is cheaper for small apps.

### Prerequisites
- ✅ Digital Ocean account
- ✅ SSH key added to DO

### Step 1: Create a Droplet

1. **Create Droplet**
   - Go to DigitalOcean → Droplets → Create
   - Choose Ubuntu 22.04 LTS
   - Size: Basic, $12/month (2 GB RAM, 1 vCPU) minimum
   - Add your SSH key
   - Enable monitoring (optional)
   - Create Droplet

2. **SSH into Droplet**
   ```bash
   ssh root@<your-droplet-ip>
   ```

### Step 2: Install Docker & Docker Compose

```bash
# Update packages
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose -y

# Verify installation
docker --version
docker-compose --version
```

### Step 3: Deploy Your Application

1. **Clone Your Repository**
   ```bash
   cd /opt
   git clone git@github.com:kevinlin29/dropmate-backend.git
   cd dropmate-backend
   ```

2. **Set Up Environment Variables**
   ```bash
   cd services/core-api
   nano .env
   ```

   Add your environment variables:
   ```env
   PORT=8080
   DATABASE_URL=postgresql://postgres:admin123@db:5432/dropmate
   JWT_SECRET=your-secure-secret-here
   FIREBASE_PROJECT_ID=dropmate-9dc10
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@dropmate-9dc10.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
   ```

3. **Add Firebase Credentials File**
   ```bash
   # Upload your Firebase service account JSON
   cd /opt/dropmate-backend
   nano dropmate-9dc10-firebase-adminsdk-fbsvc-42fe6af318.json
   # Paste the JSON content
   ```

4. **Start Services**
   ```bash
   cd /opt/dropmate-backend
   docker-compose up -d
   ```

5. **Check Status**
   ```bash
   docker-compose ps
   docker-compose logs -f
   ```

### Step 4: Initialize Database

```bash
# Wait for database to be ready
docker-compose exec db psql -U postgres -d dropmate -c "SELECT 1"

# Run schema migrations
docker-compose exec db psql -U postgres -d dropmate -f /docker-entrypoint-initdb.d/schema/01_init_schema.sql
docker-compose exec db psql -U postgres -d dropmate -f /docker-entrypoint-initdb.d/schema/02_firebase_auth.sql
docker-compose exec db psql -U postgres -d dropmate -f /docker-entrypoint-initdb.d/schema/08_partitioning.sql
```

### Step 5: Configure Firewall

```bash
# Allow SSH, HTTP, HTTPS
ufw allow OpenSSH
ufw allow 8080/tcp  # Core API
ufw allow 8081/tcp  # Location Service
ufw allow 8082/tcp  # Notification Service
ufw allow 80/tcp    # HTTP (for later SSL setup)
ufw allow 443/tcp   # HTTPS
ufw enable
```

### Step 6: Set Up Nginx Reverse Proxy (Optional but Recommended)

```bash
# Install Nginx
apt install nginx -y

# Create Nginx config
nano /etc/nginx/sites-available/dropmate
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain

    # Core API
    location /api {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket notifications
    location /ws {
        proxy_pass http://localhost:8082;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Location service (internal - optional to expose)
    location /location {
        proxy_pass http://localhost:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable the site:
```bash
ln -s /etc/nginx/sites-available/dropmate /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### Step 7: Add SSL with Let's Encrypt

```bash
# Install Certbot
apt install certbot python3-certbot-nginx -y

# Get SSL certificate
certbot --nginx -d your-domain.com

# Auto-renewal is set up automatically
```

### Step 8: Auto-Deploy on Git Push (Optional)

Set up a webhook or GitHub Actions to auto-deploy:

```bash
# Create deploy script
nano /opt/deploy.sh
```

Add:
```bash
#!/bin/bash
cd /opt/dropmate-backend
git pull origin main
docker-compose down
docker-compose up -d --build
docker-compose logs -f
```

Make it executable:
```bash
chmod +x /opt/deploy.sh
```

---

## Cost Comparison

### App Platform (Option 1)
- **3 Services** (basic-xxs): ~$15/month
- **PostgreSQL Dev DB**: ~$7/month
- **Managed Redis**: ~$15/month
- **Total**: ~$37/month

### Droplet (Option 2)
- **Droplet (2GB)**: $12/month
- **Includes**: All services, PostgreSQL, Redis
- **Total**: $12/month

---

## Recommended Approach

**For Production**: Use **App Platform** (Option 1) - easier management, auto-scaling
**For Development/MVP**: Use **Droplet** (Option 2) - cheaper, more control

---

## Testing Your Deployment

Once deployed, test your endpoints:

```bash
# Replace with your actual domain/IP
API_URL="https://your-app.ondigitalocean.app"  # Or http://your-droplet-ip:8080

# Health check
curl $API_URL/health

# Test authentication (get a Firebase token first)
curl $API_URL/api/users/me \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

---

## Troubleshooting

### App Platform Issues
- Check logs: Apps → Your App → Runtime Logs
- Verify environment variables are set correctly
- Ensure Dockerfiles build successfully locally

### Droplet Issues
```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs core-api
docker-compose logs db

# Restart services
docker-compose restart

# Check database connection
docker-compose exec db psql -U postgres -d dropmate -c "\dt"
```

### Database Connection Issues
- Verify `DATABASE_URL` is set correctly
- Check if database is initialized
- Run schema migrations

---

## Next Steps

1. Set up monitoring (DigitalOcean Monitoring or external)
2. Configure backups for database
3. Set up CI/CD with GitHub Actions
4. Add domain name and SSL
5. Set up log aggregation (Papertrail, Logtail, etc.)

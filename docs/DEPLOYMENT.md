# 🚀 Deployment Guide - E-Commerce API

Complete guide for deploying to staging and production environments.

---

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [CI/CD Pipeline](#cicd-pipeline)
- [Deployment Environments](#deployment-environments)
- [Manual Deployment](#manual-deployment)
- [Rollback Procedures](#rollback-procedures)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

---

## 🔧 Prerequisites

### Local Setup
```bash
# Required software
- Docker >= 24.0
- Docker Compose >= 2.20
- Node.js >= 20 (for local testing)
- Git
```

### Server Requirements

**Production Server:**
- **CPU:** 2+ cores
- **RAM:** 4GB minimum, 8GB recommended
- **Storage:** 50GB SSD
- **OS:** Ubuntu 22.04 LTS or Amazon Linux 2023
- **Network:** Static IP, domain configured

**Staging Server:**
- **CPU:** 1-2 cores
- **RAM:** 2GB minimum
- **Storage:** 20GB

---

## 🔄 CI/CD Pipeline

### Workflows Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Git Workflow                         │
├─────────────────────────────────────────────────────────────┤
│  develop branch  →  Automatic deploy to STAGING            │
│  main branch     →  CI tests only                           │
│  v*.*.* tags     →  Manual deploy to PRODUCTION (approval)  │
└─────────────────────────────────────────────────────────────┘
```

### 1. Continuous Integration (CI)

**Triggers:** Push to `main` or `develop`, Pull Requests

**Steps:**
1. ✅ Lint code
2. ✅ Run unit tests
3. ✅ Run e2e tests
4. ✅ Build application
5. ✅ Security scan (npm audit + Snyk)
6. ✅ Upload coverage reports

**File:** `.github/workflows/ci.yml`

```bash
# CI runs automatically on every push/PR
# No action needed from developers
```

---

### 2. Staging Deployment (CD)

**Triggers:** Push to `develop` branch OR manual trigger

**Steps:**
1. ✅ Run tests
2. ✅ Build Docker image
3. ✅ Push to Docker Hub (tag: `staging`)
4. ✅ Deploy to staging server via SSH
5. ✅ Run database migrations
6. ✅ Health check
7. ✅ Notify Slack

**File:** `.github/workflows/cd-staging.yml`

**Manual trigger:**
```bash
# GitHub UI: Actions → CD - Deploy to Staging → Run workflow
```

---

### 3. Production Deployment (CD)

**Triggers:** 
- Git tag `v*.*.*` (e.g., `v1.0.0`)
- Manual trigger with approval

**Steps:**
1. ✅ Run full test suite
2. ✅ Build Docker image (multi-tags)
3. ✅ Create database backup
4. ✅ Blue-Green deployment
5. ✅ Run migrations
6. ✅ Health checks & smoke tests
7. ✅ Automatic rollback on failure
8. ✅ Create GitHub release
9. ✅ Notify team

**File:** `.github/workflows/cd-production.yml`

**Deploy via Git tag:**
```bash
# Create a release tag
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# CI/CD will automatically trigger production deployment
```

**Manual deploy:**
```bash
# GitHub UI: Actions → CD - Deploy to Production → Run workflow
# Enter version (e.g., v1.0.0)
# Requires manual approval in GitHub
```

---

## 🌍 Deployment Environments

### Staging Environment

**URL:** `https://api-staging.yourdomain.com`

**Purpose:**
- Test new features before production
- QA testing
- Integration testing with frontend

**Configuration:**
```bash
# Use test credentials
STRIPE_SECRET_KEY=sk_test_xxxxx
DATABASE_NAME=ecommerce_staging
AWS_S3_BUCKET=your-bucket-staging
```

**Deployment:**
```bash
# Automatic on push to develop
git push origin develop

# Or manual
cd /path/to/project
./scripts/deploy-staging.sh
```

---

### Production Environment

**URL:** `https://api.yourdomain.com`

**Security:**
- ✅ HTTPS only (TLS 1.2+)
- ✅ Rate limiting (Nginx + Throttler)
- ✅ CORS configured
- ✅ Security headers
- ✅ Database backups (automated)

**Configuration:**
```bash
# Production credentials
cp .env.production.example .env
# Fill all required values

# CRITICAL: Never commit .env to git!
```

---

## 🛠️ Manual Deployment

### First-Time Server Setup

**1. Prepare Server**
```bash
# SSH to server
ssh user@your-server-ip

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Create app directory
sudo mkdir -p /var/www/ecommerce-api
sudo chown $USER:$USER /var/www/ecommerce-api
cd /var/www/ecommerce-api
```

**2. Clone Repository**
```bash
git clone https://github.com/yourusername/ecommerce-api.git .

# Or for private repos
git clone git@github.com:yourusername/ecommerce-api.git .
```

**3. Configure Environment**
```bash
# Copy and edit .env
cp .env.production.example .env
nano .env

# Generate JWT secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**4. SSL Certificates (Let's Encrypt)**
```bash
# Install Certbot
sudo apt-get install certbot

# Obtain certificate
sudo certbot certonly --standalone -d api.yourdomain.com

# Copy to nginx folder
sudo cp /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/api.yourdomain.com/privkey.pem nginx/ssl/

# Setup auto-renewal
sudo crontab -e
# Add: 0 3 * * * certbot renew --quiet --deploy-hook "docker-compose -f /var/www/ecommerce-api/docker-compose.prod.yml restart nginx"
```

**5. Deploy**
```bash
# Run deployment script
./scripts/deploy.sh

# Or manually
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml exec api npm run migration:run
```

---

### Updating Production

```bash
# Pull latest code
git pull origin main

# Run deployment
./scripts/deploy.sh

# Check logs
docker-compose -f docker-compose.prod.yml logs -f api
```

---

## ⏮️ Rollback Procedures

### Automatic Rollback

If deployment fails health checks, automatic rollback occurs:
1. Restores previous Docker image
2. Restores database from backup
3. Restarts services
4. Notifies team

### Manual Rollback

**Using script:**
```bash
./scripts/rollback.sh

# Will show available backups
# Select backup to restore
```

**Manual steps:**
```bash
# 1. List available backups
ls -lht backups/

# 2. Stop current API
docker-compose -f docker-compose.prod.yml stop api

# 3. Restore database
docker-compose -f docker-compose.prod.yml exec -T postgres \
  psql -U $POSTGRES_USER $POSTGRES_DB < backups/db-backup-YYYYMMDD-HHMMSS.sql

# 4. Rollback to previous image
docker pull yourusername/ecommerce-api:v1.0.0
docker-compose -f docker-compose.prod.yml up -d

# 5. Verify
curl -f https://api.yourdomain.com/health
```

---

## 📊 Monitoring

### Health Checks

**Endpoint:** `https://api.yourdomain.com/health`

```bash
# Manual check
curl https://api.yourdomain.com/health | jq

# Response
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" },
    "memory": { "status": "up" }
  }
}
```

**Automated monitoring:**
```bash
# Add to cron for alerts
*/5 * * * * /var/www/ecommerce-api/scripts/health-check.sh || mail -s "API Down" admin@example.com
```

---

### Logs

**View logs:**
```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f api

# Last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100 api

# Filter by error
docker-compose -f docker-compose.prod.yml logs api | grep ERROR
```

**Log rotation:**
Logs are automatically rotated (see `docker-compose.prod.yml`):
```yaml
logging:
  options:
    max-size: "10m"
    max-file: "3"
```

---

### Database Backups

**Automated backups:**
```bash
# Add to crontab
0 2 * * * docker-compose -f /var/www/ecommerce-api/docker-compose.prod.yml exec -T postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > /var/www/ecommerce-api/backups/db-backup-$(date +\%Y\%m\%d-\%H\%M\%S).sql

# Keep last 30 days
0 3 * * * find /var/www/ecommerce-api/backups/ -name "db-backup-*.sql" -mtime +30 -delete
```

**Manual backup:**
```bash
./scripts/backup-db.sh
```

---

## 🐛 Troubleshooting

### API Not Responding

```bash
# Check container status
docker-compose -f docker-compose.prod.yml ps

# Check logs
docker-compose -f docker-compose.prod.yml logs api

# Restart service
docker-compose -f docker-compose.prod.yml restart api
```

### Database Connection Issues

```bash
# Check Postgres health
docker-compose -f docker-compose.prod.yml exec postgres pg_isready

# Check connection from API
docker-compose -f docker-compose.prod.yml exec api npm run typeorm:check

# Restart Postgres (caution!)
docker-compose -f docker-compose.prod.yml restart postgres
```

### Redis Issues

```bash
# Check Redis
docker-compose -f docker-compose.prod.yml exec redis redis-cli ping

# Clear cache
docker-compose -f docker-compose.prod.yml exec redis redis-cli FLUSHALL
```

### Disk Space Full

```bash
# Check disk usage
df -h

# Clean Docker
docker system prune -a --volumes -f

# Clean old backups
find backups/ -name "*.sql" -mtime +7 -delete
```

### SSL Certificate Expired

```bash
# Renew certificate
sudo certbot renew

# Reload Nginx
docker-compose -f docker-compose.prod.yml restart nginx
```

---

## 🔐 GitHub Secrets Setup

Required secrets in GitHub repository settings:

```bash
# Docker Hub
DOCKER_USERNAME=your-dockerhub-username
DOCKER_PASSWORD=your-dockerhub-token

# Staging Server
STAGING_HOST=staging.example.com
STAGING_USER=deploy
STAGING_SSH_KEY=<private-ssh-key>
STAGING_PORT=22

# Production Server
PRODUCTION_HOST=prod.example.com
PRODUCTION_USER=deploy
PRODUCTION_SSH_KEY=<private-ssh-key>
PRODUCTION_PORT=22

# Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx

# Security Scanning
SNYK_TOKEN=your-snyk-token
```

---

## 📞 Support

- **Documentation:** [README.md](../README.md)
- **Issues:** GitHub Issues
- **Emergency:** Check #ops-alerts Slack channel

---

## ✅ Deployment Checklist

Before deploying to production:

- [ ] All tests passing locally
- [ ] Staging deployment successful
- [ ] Database migrations tested
- [ ] Environment variables configured
- [ ] SSL certificates valid
- [ ] Backups configured
- [ ] Monitoring set up
- [ ] Team notified
- [ ] Rollback plan ready
- [ ] Documentation updated

---

**Last Updated:** 2026-06-07

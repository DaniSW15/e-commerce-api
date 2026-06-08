#!/bin/bash

# ==================================================
# E-Commerce API - Production Deployment Script
# ==================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_DIR="./backups"
LOG_FILE="./logs/deployment-$(date +%Y%m%d-%H%M%S).log"

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

# Create necessary directories
mkdir -p "$BACKUP_DIR" logs

log "Starting production deployment..."

# Check if .env file exists
if [ ! -f .env ]; then
    error ".env file not found!"
    exit 1
fi

# Load environment variables
source .env

# Confirm deployment
echo ""
read -p "Are you sure you want to deploy to PRODUCTION? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    warning "Deployment cancelled by user"
    exit 0
fi

# Pre-deployment health check
log "Running pre-deployment health checks..."
if docker-compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
    log "Current deployment is running"
    
    # Create database backup
    log "Creating database backup..."
    BACKUP_FILE="$BACKUP_DIR/db-backup-$(date +%Y%m%d-%H%M%S).sql"
    docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$BACKUP_FILE"
    
    if [ -f "$BACKUP_FILE" ]; then
        log "Database backup created: $BACKUP_FILE"
    else
        error "Failed to create database backup!"
        exit 1
    fi
else
    log "No existing deployment found"
fi

# Pull latest images
log "Pulling latest Docker images..."
docker-compose -f "$COMPOSE_FILE" pull

# Start new containers (blue-green deployment)
log "Starting new containers..."
docker-compose -f "$COMPOSE_FILE" up -d --force-recreate --remove-orphans

# Wait for services to be healthy
log "Waiting for services to be healthy..."
sleep 10

MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
        log "Health check passed ✓"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        warning "Health check failed, retrying... ($RETRY_COUNT/$MAX_RETRIES)"
        sleep 2
    fi
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    error "Health check failed after $MAX_RETRIES attempts!"
    log "Rolling back deployment..."
    
    # Rollback
    if [ -f "$BACKUP_FILE" ]; then
        docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB" < "$BACKUP_FILE"
        log "Database restored from backup"
    fi
    
    docker-compose -f "$COMPOSE_FILE" down
    error "Deployment failed and rolled back!"
    exit 1
fi

# Run database migrations
log "Running database migrations..."
docker-compose -f "$COMPOSE_FILE" exec -T api npm run migration:run || {
    error "Migration failed!"
    exit 1
}

# Cleanup old images
log "Cleaning up old Docker images..."
docker image prune -f

# Final health check
log "Performing final health check..."
HEALTH_RESPONSE=$(curl -s http://localhost:3000/health)
log "Health response: $HEALTH_RESPONSE"

# Deployment successful
echo ""
log "================================================================"
log "✓ Deployment completed successfully!"
log "================================================================"
log "API is running at: http://localhost:3000"
log "Health check: http://localhost:3000/health"
log "Swagger docs: http://localhost:3000/api-docs"
log "Database backup: $BACKUP_FILE"
log "Deployment log: $LOG_FILE"
echo ""

# Show running containers
log "Current running containers:"
docker-compose -f "$COMPOSE_FILE" ps

exit 0

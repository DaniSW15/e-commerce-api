#!/bin/bash

# ==================================================
# E-Commerce API - Rollback Script
# ==================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_DIR="./backups"

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

log "Starting rollback process..."

# List available backups
echo ""
log "Available database backups:"
ls -lht "$BACKUP_DIR"/db-backup-*.sql | head -10

# Select backup
echo ""
read -p "Enter backup file name (or press Enter for latest): " backup_file

if [ -z "$backup_file" ]; then
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/db-backup-*.sql | head -1)
    log "Using latest backup: $LATEST_BACKUP"
    backup_file="$LATEST_BACKUP"
else
    backup_file="$BACKUP_DIR/$backup_file"
fi

if [ ! -f "$backup_file" ]; then
    error "Backup file not found: $backup_file"
    exit 1
fi

# Confirm rollback
echo ""
warning "This will restore the database and restart all services."
read -p "Are you sure you want to rollback? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    warning "Rollback cancelled"
    exit 0
fi

# Stop current containers
log "Stopping current containers..."
docker-compose -f "$COMPOSE_FILE" stop api

# Restore database
log "Restoring database from backup: $backup_file"
source .env
docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB" < "$backup_file"

if [ $? -eq 0 ]; then
    log "Database restored successfully"
else
    error "Failed to restore database!"
    exit 1
fi

# Restart containers
log "Restarting containers..."
docker-compose -f "$COMPOSE_FILE" up -d

# Wait for health check
log "Waiting for services to be healthy..."
sleep 10

MAX_RETRIES=20
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
        log "Health check passed ✓"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        warning "Waiting for health check... ($RETRY_COUNT/$MAX_RETRIES)"
        sleep 2
    fi
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    error "Health check failed after rollback!"
    exit 1
fi

echo ""
log "================================================================"
log "✓ Rollback completed successfully!"
log "================================================================"
log "Restored from: $backup_file"
log "API is running at: http://localhost:3000"
echo ""

docker-compose -f "$COMPOSE_FILE" ps

exit 0

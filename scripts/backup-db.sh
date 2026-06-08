#!/bin/bash

# ==================================================
# Database Backup Script
# ==================================================

set -e

GREEN='\033[0;32m'
NC='\033[0m'

BACKUP_DIR="./backups"
COMPOSE_FILE="docker-compose.prod.yml"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/db-backup-$TIMESTAMP.sql"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo -e "${GREEN}Creating database backup...${NC}"

# Load environment
source .env

# Create backup
docker-compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$BACKUP_FILE"

if [ -f "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✓ Backup created: $BACKUP_FILE ($SIZE)${NC}"
    
    # Compress backup
    gzip "$BACKUP_FILE"
    echo -e "${GREEN}✓ Backup compressed: $BACKUP_FILE.gz${NC}"
    
    # Delete backups older than 30 days
    find "$BACKUP_DIR" -name "db-backup-*.sql.gz" -mtime +30 -delete
    echo -e "${GREEN}✓ Old backups cleaned${NC}"
else
    echo "✗ Failed to create backup"
    exit 1
fi

exit 0

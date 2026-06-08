#!/bin/bash

# ==================================================
# Health Check Script
# ==================================================

URL="${1:-http://localhost:3000}"

echo "Checking health of: $URL"

# Health endpoint
HEALTH=$(curl -s -w "\n%{http_code}" "$URL/health")
HTTP_CODE=$(echo "$HEALTH" | tail -n1)
RESPONSE=$(echo "$HEALTH" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
    echo "✓ Health check passed"
    echo "$RESPONSE" | jq '.'
    
    # Check database
    DB_STATUS=$(echo "$RESPONSE" | jq -r '.details.database.status')
    if [ "$DB_STATUS" == "up" ]; then
        echo "✓ Database: OK"
    else
        echo "✗ Database: DOWN"
        exit 1
    fi
    
    # Check Redis
    REDIS_STATUS=$(echo "$RESPONSE" | jq -r '.details.redis.status')
    if [ "$REDIS_STATUS" == "up" ]; then
        echo "✓ Redis: OK"
    else
        echo "✗ Redis: DOWN"
        exit 1
    fi
    
    exit 0
else
    echo "✗ Health check failed (HTTP $HTTP_CODE)"
    exit 1
fi

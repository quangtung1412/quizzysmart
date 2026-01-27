#!/bin/sh
# Docker Backend Entrypoint Script
# Automatically restore latest backup if database is empty

set -e

echo "=========================================="
echo "Backend Container Starting..."
echo "=========================================="

# Wait for MySQL to be ready
echo "Waiting for MySQL to be ready..."
MAX_WAIT=60
WAITED=0
until nc -z mysql 3306; do
  echo "MySQL is unavailable - sleeping (${WAITED}s/${MAX_WAIT}s)"
  sleep 2
  WAITED=$((WAITED + 2))
  if [ "$WAITED" -ge "$MAX_WAIT" ]; then
    echo "ERROR: MySQL did not become available within ${MAX_WAIT}s"
    exit 1
  fi
done
echo "MySQL is ready!"

# Additional wait for MySQL to be fully initialized
echo "Waiting for MySQL to accept connections..."
sleep 5

# Check if database is empty (no tables)
echo ""
echo "Checking database state..."
TABLE_COUNT=$(mysql -h mysql -u root -prootpassword --skip-ssl quizzysmart -e "SHOW TABLES;" 2>/dev/null | wc -l || echo "0")

echo "Found $TABLE_COUNT table entries"

if [ "$TABLE_COUNT" -le 1 ]; then
  echo "Database is empty, initializing..."
  
  # Run Prisma migration first to create schema
  echo ""
  echo "=========================================="
  echo "Running Prisma DB Push to create schema..."
  echo "=========================================="
  npx prisma db push --accept-data-loss --skip-generate 2>&1 || {
    echo "WARNING: Prisma db push had issues, continuing..."
  }
  
  # Check for backup files to import data
  if [ -d "/backups" ]; then
    # Find the most recent backup (sorted by filename which contains timestamp)
    LATEST_BACKUP=$(find /backups -maxdepth 1 -name "*.sql" -type f 2>/dev/null | sort -r | head -n 1)
    
    if [ -n "$LATEST_BACKUP" ] && [ -f "$LATEST_BACKUP" ]; then
      echo ""
      echo "=========================================="
      echo "Found backup: $(basename $LATEST_BACKUP)"
      echo "File size: $(du -h "$LATEST_BACKUP" | cut -f1)"
      echo "Importing data from backup..."
      echo "=========================================="
      
      # Import the SQL file (--skip-ssl to avoid TLS cert issues in container)
      if mysql -h mysql -u root -prootpassword --skip-ssl quizzysmart < "$LATEST_BACKUP" 2>&1; then
        echo "[OK] Backup imported successfully!"
        
        # Verify import
        NEW_TABLE_COUNT=$(mysql -h mysql -u root -prootpassword --skip-ssl quizzysmart -e "SHOW TABLES;" 2>/dev/null | wc -l || echo "0")
        echo "[OK] Database now has $((NEW_TABLE_COUNT - 1)) tables"
      else
        echo "[ERROR] Backup import had errors, database may be partially restored"
      fi
    else
      echo "No SQL backup files found in /backups directory"
    fi
  else
    echo "No /backups directory mounted"
  fi
else
  echo "Database already initialized ($(($TABLE_COUNT - 1)) tables found)"
  echo "Syncing schema with Prisma..."
  npx prisma db push --accept-data-loss --skip-generate 2>&1 || {
    echo "WARNING: Prisma db push had issues, continuing..."
  }
fi

echo ""
echo "=========================================="
echo "Starting Application Server..."
echo "=========================================="
echo ""

# Start the application
exec node dist/index.js

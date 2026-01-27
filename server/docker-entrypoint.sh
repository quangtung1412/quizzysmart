#!/bin/sh
# Docker Backend Entrypoint Script
# Automatically restore latest backup if database is empty

set -e

echo "=========================================="
echo "Backend Container Starting..."
echo "=========================================="

# Wait for MySQL to be ready
echo "Waiting for MySQL to be ready..."
until nc -z mysql 3306; do
  echo "MySQL is unavailable - sleeping"
  sleep 2
done
echo "MySQL is ready!"

# Check if database is empty (no tables)
echo ""
echo "Checking database state..."
TABLE_COUNT=$(mysql -h mysql -u root -prootpassword --skip-ssl quizzysmart -e "SHOW TABLES;" 2>/dev/null | wc -l)

if [ "$TABLE_COUNT" -le 1 ]; then
  echo "Database is empty, initializing..."
  
  # Check for backup files
  if [ -d "/backups" ] && [ -n "$(ls -A /backups/*.sql 2>/dev/null)" ]; then
    # Find the most recent backup
    LATEST_BACKUP=$(ls -t /backups/*.sql 2>/dev/null | head -n 1)
    
    if [ -n "$LATEST_BACKUP" ]; then
      echo ""
      echo "=========================================="
      echo "Found backup: $(basename $LATEST_BACKUP)"
      echo "Restoring database from backup..."
      echo "=========================================="
      
      cat "$LATEST_BACKUP" | mysql -h mysql -u root -prootpassword --skip-ssl 2>&1 | grep -v "Warning\|Deprecated" || true
      
      if [ $? -eq 0 ]; then
        echo "✓ Backup restored successfully!"
      else
        echo "✗ Backup restore failed, will create empty schema"
        npx prisma db push --accept-data-loss --skip-generate || true
      fi
    else
      echo "No backup found, creating empty schema..."
      npx prisma db push --accept-data-loss --skip-generate || true
    fi
  else
    echo "No backup directory or files, creating empty schema..."
    npx prisma db push --accept-data-loss --skip-generate || true
  fi
else
  echo "Database already initialized ($(($TABLE_COUNT - 1)) tables found)"
  echo "Syncing schema..."
  npx prisma db push --accept-data-loss --skip-generate || true
fi

echo ""
echo "=========================================="
echo "Starting Application Server..."
echo "=========================================="
echo ""

# Start the application
exec node dist/index.js

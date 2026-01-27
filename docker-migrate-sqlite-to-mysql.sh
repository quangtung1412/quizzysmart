#!/bin/bash
# ============================================
# Migrate SQLite to MySQL (Docker - Linux)
# ============================================

set -e

SQLITE_FILE="server/prisma/dev.db"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -i|--input)
            SQLITE_FILE="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [-i|--input sqlite_file]"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "============================================"
echo "Docker: SQLite to MySQL Migration"
echo "============================================"
echo ""

# Check if SQLite file exists
if [ ! -f "$SQLITE_FILE" ]; then
    echo "ERROR: SQLite file not found: $SQLITE_FILE"
    exit 1
fi

# Check containers
echo "[1/5] Checking Docker containers..."
if ! docker compose ps mysql | grep -q "running"; then
    echo "ERROR: MySQL container is not running!"
    exit 1
fi
if ! docker compose ps backend | grep -q "running"; then
    echo "ERROR: Backend container is not running!"
    exit 1
fi
echo "    All containers running!"

# Backup current MySQL data first
echo ""
echo "[2/5] Creating backup of current MySQL data..."
./docker-backup-mysql.sh -n "before_migration"
if [ $? -ne 0 ]; then
    echo "WARNING: Backup failed, but continuing..."
fi

# Clear MySQL database
echo ""
echo "[3/5] Preparing MySQL database..."
docker compose exec mysql mysql -u root -prootpassword -e "SET NAMES utf8mb4; DROP DATABASE IF EXISTS quizzysmart; CREATE DATABASE quizzysmart CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>&1 | grep -v "Warning: Using a password" || true

# Run migrations
echo "    Creating tables..."
docker compose exec backend npx prisma migrate deploy 2>&1 | grep -v "Warning" || true
if [ ${PIPESTATUS[0]} -ne 0 ]; then
    # Try migrate dev if deploy fails
    docker compose exec backend npx prisma migrate dev --name migration_from_sqlite --skip-seed 2>&1 | grep -E "Applied|created|Your database" || true
fi

# Run migration
echo ""
echo "[4/5] Migrating data from SQLite to MySQL..."
echo "    This may take several minutes for large databases..."
echo ""

# Container path
CONTAINER_SQLITE_PATH="/app/prisma/dev.db"

# Run migration script inside container
docker compose exec backend node migrate-sqlite-to-mysql.mjs "$CONTAINER_SQLITE_PATH"

if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: Migration failed!"
    echo "Check the logs above for details."
    exit 1
fi

# Verify migration
echo ""
echo "[5/5] Verifying migration..."
docker compose exec mysql mysql -u root -prootpassword quizzysmart -e "SELECT 'Users' as tbl, COUNT(*) as cnt FROM User UNION SELECT 'Questions', COUNT(*) FROM Question UNION SELECT 'KnowledgeBases', COUNT(*) FROM KnowledgeBase UNION SELECT 'Documents', COUNT(*) FROM documents UNION SELECT 'StudyPlans', COUNT(*) FROM StudyPlan UNION SELECT 'QuestionProgress', COUNT(*) FROM QuestionProgress;" 2>&1 | grep -v "Warning: Using a password"

# Restart backend
echo ""
echo "Restarting backend container..."
docker compose restart backend >/dev/null
sleep 3

echo ""
echo "============================================"
echo "MIGRATION SUCCESSFUL!"
echo "============================================"
echo ""
echo "Data has been migrated from SQLite to MySQL"
echo ""
echo "Application URLs:"
echo "  Frontend:   http://localhost:5173"
echo "  Backend:    http://localhost:3000"
echo "  phpMyAdmin: http://localhost:8080"
echo ""
echo "Note: Original SQLite file is preserved at: $SQLITE_FILE"
echo ""

#!/bin/bash
# ============================================
# MySQL Database Restore (Docker - Linux)
# ============================================

set -e

BACKUP_FILE=""
FORCE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--file)
            BACKUP_FILE="$2"
            shift 2
            ;;
        --force)
            FORCE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 -f|--file backup_file [--force]"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

if [ -z "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file required!"
    echo "Usage: $0 -f|--file backup_file [--force]"
    exit 1
fi

echo "============================================"
echo "Docker: MySQL Database Restore"
echo "============================================"
echo ""

# Check backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "[1/5] Checking backup file..."
FILE_SIZE=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE" 2>/dev/null)
FILE_SIZE_MB=$(echo "scale=2; $FILE_SIZE/1024/1024" | bc)
echo "    File: $BACKUP_FILE"
echo "    Size: ${FILE_SIZE_MB} MB"

# Check if compressed
IS_ZIP=false
SQL_FILE="$BACKUP_FILE"
if [[ "$BACKUP_FILE" == *.zip ]]; then
    IS_ZIP=true
    echo ""
    echo "[2/5] Extracting backup..."
    TEMP_DIR="temp_restore_$(date +%Y%m%d%H%M%S)"
    mkdir -p "$TEMP_DIR"
    unzip -q "$BACKUP_FILE" -d "$TEMP_DIR"
    SQL_FILE=$(find "$TEMP_DIR" -name "*.sql" | head -n 1)
    if [ -z "$SQL_FILE" ]; then
        echo "ERROR: No SQL file found in ZIP!"
        rm -rf "$TEMP_DIR"
        exit 1
    fi
    echo "    Extracted: $SQL_FILE"
else
    echo ""
    echo "[2/5] Skipping extraction (not compressed)"
fi

# Check MySQL container
echo ""
echo "[3/5] Checking MySQL container..."
if ! docker compose ps mysql | grep -q "running"; then
    echo "ERROR: MySQL container is not running!"
    [ "$IS_ZIP" = true ] && rm -rf "$TEMP_DIR"
    exit 1
fi
echo "    MySQL is running!"

# Warning
if [ "$FORCE" = false ]; then
    echo ""
    echo "WARNING: This will DROP and recreate the database!"
    echo "         All current data will be LOST!"
    echo ""
    read -p "Type 'yes' to continue: " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo "Restore cancelled."
        [ "$IS_ZIP" = true ] && rm -rf "$TEMP_DIR"
        exit 0
    fi
fi

# Restore database
echo ""
echo "[4/5] Restoring database..."
echo "    This may take a few minutes..."

cat "$SQL_FILE" | docker compose exec -T mysql mysql -u root -prootpassword 2>&1 | grep -v "Warning: Using a password" || true

if [ ${PIPESTATUS[1]} -ne 0 ]; then
    echo "ERROR: Restore failed!"
    [ "$IS_ZIP" = true ] && rm -rf "$TEMP_DIR"
    exit 1
fi

echo "    Database restored!"

# Cleanup
if [ "$IS_ZIP" = true ]; then
    rm -rf "$TEMP_DIR"
    echo "    Cleaned up temporary files"
fi

# Verify restore
echo ""
echo "[5/5] Verifying restore..."
docker compose exec mysql mysql -u root -prootpassword quizzysmart -e "SELECT 'Users' as tbl, COUNT(*) as cnt FROM User UNION SELECT 'Questions', COUNT(*) FROM Question UNION SELECT 'KnowledgeBases', COUNT(*) FROM KnowledgeBase UNION SELECT 'Documents', COUNT(*) FROM documents UNION SELECT 'StudyPlans', COUNT(*) FROM StudyPlan;" 2>&1 | grep -v "Warning: Using a password"

# Restart backend to refresh connection
echo ""
echo "Restarting backend container..."
docker compose restart backend >/dev/null
sleep 3

echo ""
echo "============================================"
echo "RESTORE SUCCESSFUL!"
echo "============================================"
echo ""
echo "Database has been restored from: $BACKUP_FILE"
echo ""
echo "Application URLs:"
echo "  Frontend:   http://localhost:5173"
echo "  Backend:    http://localhost:3000"
echo "  phpMyAdmin: http://localhost:8080"
echo ""

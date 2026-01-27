#!/bin/bash
# ============================================
# MySQL Database Backup (Docker - Linux)
# ============================================

set -e

BACKUP_NAME=""
COMPRESS=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--name)
            BACKUP_NAME="$2"
            shift 2
            ;;
        -c|--compress)
            COMPRESS=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [-n|--name backup_name] [-c|--compress]"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "============================================"
echo "Docker: MySQL Database Backup"
echo "============================================"
echo ""

# Check MySQL container
echo "[1/4] Checking MySQL container..."
if ! docker compose ps mysql | grep -q "running"; then
    echo "ERROR: MySQL container is not running!"
    exit 1
fi
echo "    MySQL is running!"

# Create backup directory
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"

# Generate backup filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
if [ -n "$BACKUP_NAME" ]; then
    BACKUP_FILE="$BACKUP_DIR/${BACKUP_NAME}_${TIMESTAMP}.sql"
else
    BACKUP_FILE="$BACKUP_DIR/quizzysmart_${TIMESTAMP}.sql"
fi

echo ""
echo "[2/4] Creating backup..."
echo "    Output: $BACKUP_FILE"

# Backup database
docker compose exec -T mysql mysqldump -u root -prootpassword \
    --databases quizzysmart \
    --single-transaction \
    --quick \
    --lock-tables=false \
    --routines \
    --triggers \
    --events \
    --add-drop-database \
    --default-character-set=utf8mb4 \
    --set-charset > "$BACKUP_FILE"

if [ $? -ne 0 ]; then
    echo "ERROR: Backup failed!"
    exit 1
fi

# Get backup size
FILE_SIZE=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE" 2>/dev/null)
FILE_SIZE_MB=$(echo "scale=2; $FILE_SIZE/1024/1024" | bc)
echo "    Backup completed: ${FILE_SIZE_MB} MB"

# Compress if requested
if [ "$COMPRESS" = true ]; then
    echo ""
    echo "[3/4] Compressing backup..."
    ZIP_FILE="${BACKUP_FILE%.sql}.zip"
    zip -q "$ZIP_FILE" "$BACKUP_FILE"
    rm "$BACKUP_FILE"
    
    ZIP_SIZE=$(stat -f%z "$ZIP_FILE" 2>/dev/null || stat -c%s "$ZIP_FILE" 2>/dev/null)
    ZIP_SIZE_MB=$(echo "scale=2; $ZIP_SIZE/1024/1024" | bc)
    RATIO=$(echo "scale=1; ($ZIP_SIZE/$FILE_SIZE)*100" | bc)
    echo "    Compressed: ${ZIP_SIZE_MB} MB (${RATIO}%)"
    BACKUP_FILE="$ZIP_FILE"
else
    echo ""
    echo "[3/4] Skipping compression"
fi

# Verify backup
echo ""
echo "[4/4] Verifying backup..."

if [ "$COMPRESS" = true ]; then
    # Check zip integrity
    if unzip -t "$BACKUP_FILE" >/dev/null 2>&1; then
        echo "    ZIP file is valid!"
    else
        echo "    WARNING: ZIP file may be corrupted!"
    fi
else
    # Check SQL file
    if head -n 10 "$BACKUP_FILE" | grep -q "MySQL dump"; then
        echo "    SQL file is valid!"
    else
        echo "    WARNING: SQL file may be invalid!"
    fi
fi

echo ""
echo "============================================"
echo "BACKUP SUCCESSFUL!"
echo "============================================"
echo ""
echo "Backup file: $BACKUP_FILE"
echo ""
echo "To restore this backup:"
echo "  ./docker-restore-mysql.sh -f \"$BACKUP_FILE\""
echo ""

# List all backups
echo "Available backups:"
ls -lh "$BACKUP_DIR"/*.sql "$BACKUP_DIR"/*.zip 2>/dev/null | awk '{printf "  %s - %s %s %s\n", $9, $5, $6, $7}'
echo ""

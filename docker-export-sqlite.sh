#!/bin/bash
# ============================================
# Export SQLite to SQL (Docker - Linux)
# ============================================

set -e

SQLITE_FILE="server/prisma/dev.db"
OUTPUT_FILE=""
COMPRESS=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -i|--input)
            SQLITE_FILE="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        -c|--compress)
            COMPRESS=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [-i|--input sqlite_file] [-o|--output output_file] [-c|--compress]"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "============================================"
echo "Docker: Export SQLite to MySQL SQL"
echo "============================================"
echo ""

# Check if SQLite file exists on host
if [ ! -f "$SQLITE_FILE" ]; then
    echo "ERROR: SQLite file not found: $SQLITE_FILE"
    echo "Make sure the file exists on your host machine."
    exit 1
fi

# Generate output filename if not provided
if [ -z "$OUTPUT_FILE" ]; then
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    OUTPUT_FILE="server/backup_sqlite_${TIMESTAMP}.sql"
fi

echo "[1/3] Preparing export..."
echo "    SQLite file: $SQLITE_FILE"
echo "    Output file: $OUTPUT_FILE"

# Check if backend container is running
if ! docker compose ps backend | grep -q "running"; then
    echo ""
    echo "ERROR: Backend container is not running!"
    echo "Start it with: docker compose up -d backend"
    exit 1
fi

echo ""
echo "[2/3] Exporting data from SQLite..."
echo "    This may take a few minutes for large databases..."

# Run export inside container
CONTAINER_SQLITE_PATH="/app/$(echo $SQLITE_FILE | sed 's|server/||')"
CONTAINER_OUTPUT_PATH="/app/$(echo $OUTPUT_FILE | sed 's|server/||')"

docker compose exec backend node export-sqlite-to-sql.mjs "$CONTAINER_SQLITE_PATH" "$CONTAINER_OUTPUT_PATH"

if [ $? -ne 0 ]; then
    echo "ERROR: Export failed!"
    exit 1
fi

# Get file size
if [ -f "$OUTPUT_FILE" ]; then
    FILE_SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null)
    FILE_SIZE_MB=$(echo "scale=2; $FILE_SIZE/1024/1024" | bc)
    echo "    Export completed: ${FILE_SIZE_MB} MB"
else
    echo "    WARNING: Output file not found on host"
fi

# Compress if requested
if [ "$COMPRESS" = true ]; then
    echo ""
    echo "[3/3] Compressing backup..."
    ZIP_FILE="${OUTPUT_FILE%.sql}.zip"
    zip -q "$ZIP_FILE" "$OUTPUT_FILE"
    rm "$OUTPUT_FILE"
    
    ZIP_SIZE=$(stat -f%z "$ZIP_FILE" 2>/dev/null || stat -c%s "$ZIP_FILE" 2>/dev/null)
    ZIP_SIZE_MB=$(echo "scale=2; $ZIP_SIZE/1024/1024" | bc)
    RATIO=$(echo "scale=1; ($ZIP_SIZE/$FILE_SIZE)*100" | bc)
    echo "    Compressed: ${ZIP_SIZE_MB} MB (${RATIO}%)"
    OUTPUT_FILE="$ZIP_FILE"
else
    echo ""
    echo "[3/3] Skipping compression"
fi

echo ""
echo "============================================"
echo "EXPORT SUCCESSFUL!"
echo "============================================"
echo ""
echo "Output file: $OUTPUT_FILE"
echo ""
echo "To import into MySQL (Docker):"
if [ "$COMPRESS" = true ]; then
    echo "  # Extract first"
    SQL_NAME="${OUTPUT_FILE%.zip}.sql"
    echo "  unzip $OUTPUT_FILE"
    echo "  cat $SQL_NAME | docker compose exec -T mysql mysql -u root -prootpassword quizzysmart"
else
    echo "  cat $OUTPUT_FILE | docker compose exec -T mysql mysql -u root -prootpassword quizzysmart"
fi
echo ""

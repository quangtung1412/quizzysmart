# ============================================
# Export SQLite to SQL (Docker Version)
# ============================================

param(
    [string]$SqliteFile = "server\prisma\dev.db",
    [string]$OutputFile = "",
    [switch]$Compress
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Docker: Export SQLite to MySQL SQL" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if SQLite file exists on host
if (-not (Test-Path $SqliteFile)) {
    Write-Host "ERROR: SQLite file not found: $SqliteFile" -ForegroundColor Red
    Write-Host "Make sure the file exists on your host machine." -ForegroundColor Yellow
    exit 1
}

# Generate output filename if not provided
if (-not $OutputFile) {
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $OutputFile = "server\backup_sqlite_${timestamp}.sql"
}

Write-Host "[1/3] Preparing export..." -ForegroundColor Yellow
Write-Host "    SQLite file: $SqliteFile" -ForegroundColor Gray
Write-Host "    Output file: $OutputFile" -ForegroundColor Gray

# Check if backend container is running
$backendStatus = docker compose ps backend --format json | ConvertFrom-Json
if ($backendStatus.State -ne "running") {
    Write-Host ""
    Write-Host "ERROR: Backend container is not running!" -ForegroundColor Red
    Write-Host "Start it with: docker compose up -d backend" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "[2/3] Exporting data from SQLite..." -ForegroundColor Yellow
Write-Host "    This may take a few minutes for large databases..." -ForegroundColor Gray

# Run export inside container
# SQLite file is already mounted via volumes, so we can access it
$containerSqlitePath = "/app/" + ($SqliteFile -replace '\\', '/' -replace 'server/', '')
$containerOutputPath = "/app/" + ($OutputFile -replace '\\', '/' -replace 'server/', '')

docker compose exec backend node export-sqlite-to-sql.mjs $containerSqlitePath $containerOutputPath

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Export failed!" -ForegroundColor Red
    exit 1
}

# Get file size
if (Test-Path $OutputFile) {
    $fileSize = (Get-Item $OutputFile).Length
    $fileSizeMB = [Math]::Round($fileSize/1MB, 2)
    Write-Host "    Export completed: $fileSizeMB MB" -ForegroundColor Green
} else {
    Write-Host "    WARNING: Output file not found on host" -ForegroundColor Yellow
}

# Compress if requested
if ($Compress) {
    Write-Host ""
    Write-Host "[3/3] Compressing backup..." -ForegroundColor Yellow
    $zipFile = $OutputFile -replace '\.sql$', '.zip'
    Compress-Archive -Path $OutputFile -DestinationPath $zipFile -Force
    Remove-Item $OutputFile
    
    $zipSize = (Get-Item $zipFile).Length
    $zipSizeMB = [Math]::Round($zipSize/1MB, 2)
    $ratio = [Math]::Round(($zipSize/$fileSize)*100, 1)
    Write-Host "    Compressed: $zipSizeMB MB ($ratio%)" -ForegroundColor Green
    $OutputFile = $zipFile
} else {
    Write-Host ""
    Write-Host "[3/3] Skipping compression" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "EXPORT SUCCESSFUL!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Output file: $OutputFile" -ForegroundColor White
Write-Host ""
Write-Host "To import into MySQL (Docker):" -ForegroundColor Yellow
if ($Compress) {
    Write-Host "  # Extract first" -ForegroundColor Gray
    $sqlName = (Get-Item $OutputFile).BaseName + ".sql"
    Write-Host "  Expand-Archive -Path $OutputFile -DestinationPath server" -ForegroundColor White
    Write-Host "  Get-Content server\$sqlName | docker compose exec -T mysql mysql -u root -prootpassword quizzysmart" -ForegroundColor White
} else {
    Write-Host "  Get-Content $OutputFile | docker compose exec -T mysql mysql -u root -prootpassword quizzysmart" -ForegroundColor White
}
Write-Host ""

# ============================================
# Export SQLite Database to MySQL SQL File
# ============================================

param(
    [string]$SqliteFile = ".\prisma\dev.db",
    [string]$OutputFile = "",
    [switch]$Compress
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "SQLite to MySQL SQL Export" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if SQLite file exists
if (-not (Test-Path $SqliteFile)) {
    Write-Host "ERROR: SQLite file not found: $SqliteFile" -ForegroundColor Red
    exit 1
}

# Generate output filename if not provided
if (-not $OutputFile) {
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $OutputFile = "backup_sqlite_${timestamp}.sql"
}

Write-Host "[1/4] Reading SQLite database..." -ForegroundColor Yellow
Write-Host "    Input: $SqliteFile" -ForegroundColor Gray

# Check if better-sqlite3 is installed
$packageJson = Get-Content "package.json" | ConvertFrom-Json
if (-not $packageJson.dependencies.'better-sqlite3' -and -not $packageJson.devDependencies.'better-sqlite3') {
    Write-Host ""
    Write-Host "Installing better-sqlite3..." -ForegroundColor Yellow
    npm install --save-dev better-sqlite3
}

# Run export script
Write-Host ""
Write-Host "[2/4] Exporting data..." -ForegroundColor Yellow
node export-sqlite-to-sql.mjs $SqliteFile $OutputFile

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Export failed!" -ForegroundColor Red
    exit 1
}

# Get file info
$fileSize = (Get-Item $OutputFile).Length
$fileSizeMB = [Math]::Round($fileSize/1MB, 2)

# Compress if requested
if ($Compress) {
    Write-Host ""
    Write-Host "[3/4] Compressing backup..." -ForegroundColor Yellow
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
    Write-Host "[3/4] Skipping compression" -ForegroundColor Yellow
}

# Verify file
Write-Host ""
Write-Host "[4/4] Verifying SQL file..." -ForegroundColor Yellow

if ($Compress) {
    try {
        $zip = [System.IO.Compression.ZipFile]::OpenRead($OutputFile)
        $zip.Dispose()
        Write-Host "    ZIP file is valid!" -ForegroundColor Green
    } catch {
        Write-Host "    WARNING: ZIP file may be corrupted!" -ForegroundColor Red
    }
} else {
    $content = Get-Content $OutputFile -First 10
    if ($content -match "SET NAMES utf8mb4") {
        Write-Host "    SQL file is valid!" -ForegroundColor Green
    } else {
        Write-Host "    WARNING: SQL file may be invalid!" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "EXPORT SUCCESSFUL!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Output file: $OutputFile" -ForegroundColor White
Write-Host ""
Write-Host "To import into MySQL:" -ForegroundColor Yellow
Write-Host "  Option 1 - Local MySQL:" -ForegroundColor Gray
Write-Host "    mysql -u root -p quizzysmart < $OutputFile" -ForegroundColor White
Write-Host ""
Write-Host "  Option 2 - Docker MySQL:" -ForegroundColor Gray
if ($Compress) {
    Write-Host "    # Extract first" -ForegroundColor White
    $sqlName = (Get-Item $OutputFile).BaseName + ".sql"
    Write-Host "    Expand-Archive -Path $OutputFile -DestinationPath ." -ForegroundColor White
    Write-Host "    Get-Content $sqlName | docker compose exec -T mysql mysql -u root -prootpassword quizzysmart" -ForegroundColor White
} else {
    Write-Host "    Get-Content $OutputFile | docker compose exec -T mysql mysql -u root -prootpassword quizzysmart" -ForegroundColor White
}
Write-Host ""
Write-Host "  Option 3 - Use migration script:" -ForegroundColor Gray
Write-Host "    node migrate-sqlite-to-mysql.mjs" -ForegroundColor White
Write-Host ""

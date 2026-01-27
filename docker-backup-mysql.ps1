# ============================================
# MySQL Database Backup (Docker Version)
# ============================================

param(
    [string]$BackupName = "",
    [switch]$Compress
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Docker: MySQL Database Backup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Check MySQL container
Write-Host ""
Write-Host "[1/4] Checking MySQL container..." -ForegroundColor Yellow
$mysqlStatus = docker compose ps mysql --format json | ConvertFrom-Json
if ($mysqlStatus.State -ne "running") {
    Write-Host "ERROR: MySQL container is not running!" -ForegroundColor Red
    exit 1
}
Write-Host "    MySQL is running!" -ForegroundColor Green

# Create backup directory
$backupDir = "backups"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

# Generate backup filename
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
if ($BackupName) {
    $backupFile = "$backupDir/${BackupName}_${timestamp}.sql"
} else {
    $backupFile = "$backupDir/quizzysmart_${timestamp}.sql"
}

Write-Host ""
Write-Host "[2/4] Creating backup..." -ForegroundColor Yellow
Write-Host "    Output: $backupFile" -ForegroundColor Gray

# Backup database
docker compose exec -T mysql mysqldump -u root -prootpassword `
    --databases quizzysmart `
    --single-transaction `
    --quick `
    --lock-tables=false `
    --routines `
    --triggers `
    --events `
    --add-drop-database `
    --default-character-set=utf8mb4 `
    --set-charset > $backupFile

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Backup failed!" -ForegroundColor Red
    exit 1
}

# Get backup size
$fileSize = (Get-Item $backupFile).Length
$fileSizeMB = [Math]::Round($fileSize/1MB, 2)
Write-Host "    Backup completed: $fileSizeMB MB" -ForegroundColor Green

# Compress if requested
if ($Compress) {
    Write-Host ""
    Write-Host "[3/4] Compressing backup..." -ForegroundColor Yellow
    $zipFile = $backupFile -replace '\.sql$', '.zip'
    Compress-Archive -Path $backupFile -DestinationPath $zipFile -Force
    Remove-Item $backupFile
    
    $zipSize = (Get-Item $zipFile).Length
    $zipSizeMB = [Math]::Round($zipSize/1MB, 2)
    $ratio = [Math]::Round(($zipSize/$fileSize)*100, 1)
    Write-Host "    Compressed: $zipSizeMB MB ($ratio%)" -ForegroundColor Green
    $backupFile = $zipFile
} else {
    Write-Host ""
    Write-Host "[3/4] Skipping compression" -ForegroundColor Yellow
}

# Verify backup
Write-Host ""
Write-Host "[4/4] Verifying backup..." -ForegroundColor Yellow

if ($Compress) {
    # Check zip integrity
    try {
        $zip = [System.IO.Compression.ZipFile]::OpenRead($backupFile)
        $zip.Dispose()
        Write-Host "    ZIP file is valid!" -ForegroundColor Green
    } catch {
        Write-Host "    WARNING: ZIP file may be corrupted!" -ForegroundColor Red
    }
} else {
    # Check SQL file
    $content = Get-Content $backupFile -First 10
    if ($content -match "MySQL dump") {
        Write-Host "    SQL file is valid!" -ForegroundColor Green
    } else {
        Write-Host "    WARNING: SQL file may be invalid!" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "BACKUP SUCCESSFUL!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backup file: $backupFile" -ForegroundColor White
Write-Host ""
Write-Host "To restore this backup:" -ForegroundColor Yellow
Write-Host "  .\docker-restore-mysql.ps1 -BackupFile `"$backupFile`"" -ForegroundColor White
Write-Host ""

# List all backups
Write-Host "Available backups:" -ForegroundColor Yellow
Get-ChildItem $backupDir -Filter "*.sql" | Sort-Object LastWriteTime -Descending | ForEach-Object {
    $size = [Math]::Round($_.Length/1MB, 2)
    Write-Host "  $($_.Name) - $size MB - $($_.LastWriteTime)" -ForegroundColor Gray
}
Get-ChildItem $backupDir -Filter "*.zip" | Sort-Object LastWriteTime -Descending | ForEach-Object {
    $size = [Math]::Round($_.Length/1MB, 2)
    Write-Host "  $($_.Name) - $size MB - $($_.LastWriteTime)" -ForegroundColor Gray
}
Write-Host ""

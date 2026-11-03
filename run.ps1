# =============================================================================
# run.ps1 — UNIV-Resolve Windows PowerShell Startup Script
# Usage: powershell -ExecutionPolicy Bypass -File .\run.ps1
# Starts: Eureka → API Gateway → User Service → Issue Service → Worker Service → Python SLA Service
# =============================================================================

$ErrorActionPreference = "Stop"
$env:JAVA_HOME = "C:\Program Files\Java\jdk-23"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
$pythonPath = "C:\Users\KIIT0001\AppData\Local\Programs\Python\Python310\python.exe"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "       UNIV-Resolve Backend Startup" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

$baseDir = $PSScriptRoot
if (-not $baseDir) { $baseDir = Get-Location }

Write-Host "[1/7] Building microservices..." -ForegroundColor Yellow
Set-Location "$baseDir\resolve"
.\mvnw.cmd test-compile -DskipTests
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Force -Path "$baseDir\logs" | Out-Null

Write-Host "[2/7] Starting Eureka Server (port 8761)..." -ForegroundColor Yellow
$eureka = Start-Process -FilePath "cmd.exe" -ArgumentList "/c mvnw.cmd spring-boot:run > `"$baseDir\logs\eureka-server.log`" 2>&1" -WorkingDirectory "$baseDir\resolve\eureka-server" -PassThru

Write-Host "[3/7] Starting API Gateway (port 8080)..." -ForegroundColor Yellow
$gateway = Start-Process -FilePath "cmd.exe" -ArgumentList "/c mvnw.cmd spring-boot:run > `"$baseDir\logs\api-gateway.log`" 2>&1" -WorkingDirectory "$baseDir\resolve\api-gateway" -PassThru

Write-Host "[4/7] Starting User Service (port 8081)..." -ForegroundColor Yellow
$userSvc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c mvnw.cmd spring-boot:run > `"$baseDir\logs\user-service.log`" 2>&1" -WorkingDirectory "$baseDir\resolve\user-service" -PassThru

Write-Host "[5/7] Starting Issue Service (port 8082)..." -ForegroundColor Yellow
$issueSvc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c mvnw.cmd spring-boot:run > `"$baseDir\logs\issue-service.log`" 2>&1" -WorkingDirectory "$baseDir\resolve\issue-service" -PassThru

Write-Host "[6/7] Starting Worker Service (port 8083)..." -ForegroundColor Yellow
$workerSvc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c mvnw.cmd spring-boot:run > `"$baseDir\logs\worker-service.log`" 2>&1" -WorkingDirectory "$baseDir\resolve\worker-service" -PassThru

Write-Host "[7/7] Starting Python SLA & Prediction Service (port 8002)..." -ForegroundColor Yellow
$slaSvc = Start-Process -FilePath $pythonPath -ArgumentList "-m uvicorn app:app --host 127.0.0.1 --port 8002" -WorkingDirectory "$baseDir\python_service" -PassThru

Write-Host ""
Write-Host "✅ All UNIV-Resolve backend services started!" -ForegroundColor Green
Write-Host "   - Eureka Dashboard:   http://localhost:8761" -ForegroundColor Green
Write-Host "   - API Gateway:        http://localhost:8080" -ForegroundColor Green
Write-Host "   - User Service:       http://localhost:8081/api/users" -ForegroundColor Green
Write-Host "   - Issue Service:      http://localhost:8082/api/issues" -ForegroundColor Green
Write-Host "   - Worker Service:     http://localhost:8083/api/workers" -ForegroundColor Green
Write-Host "   - Python SLA Service: http://localhost:8002/health" -ForegroundColor Green
Write-Host ""
Write-Host "To run frontend: cd client; npm run dev" -ForegroundColor Cyan
Write-Host "Press Ctrl+C or close this window to stop services." -ForegroundColor Yellow

Set-Location $baseDir


@echo off
cd /d "%~dp0"
taskkill /F /IM node.exe /T >NUL 2>&1
timeout /t 2 /nobreak >NUL

echo Building frontend...
call npm run build
if errorlevel 1 (
    echo BUILD FAILED!
    pause
    exit /b 1
)

echo Starting server...
start "GameServer" cmd /k "cd /d %~dp0 && node server/index.js"
timeout /t 4 /nobreak >NUL
start "" http://localhost:8080

echo.
echo ========================================
echo   Game running at http://localhost:3000
echo ========================================

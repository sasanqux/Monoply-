@echo off
cd /d "%~dp0"

echo ========================================
echo    Chongqing Monopoly - Starting...
echo ========================================
echo.

echo [1/3] Cleaning old build...
if exist dist rmdir /s /q dist

echo.
echo [2/3] Building project...
call npm run build
if errorlevel 1 (
    echo.
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo.
echo [3/3] Starting server...
echo.
echo ========================================
echo    Game ready! Opening browser...
echo    http://localhost:5173
echo ========================================
echo.
echo Press Ctrl+C to stop the server.
echo.

start "" http://localhost:5173
npx vite preview --port 5173 --host

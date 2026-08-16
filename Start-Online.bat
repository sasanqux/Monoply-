@echo off
chcp 65001 >/dev/null 2>&1
cd /d "%~dp0"

echo ========================================
echo    重庆大富翁 · 联机上线
echo ========================================
echo.

echo [1/3] 构建前端...
call npm run build
if errorlevel 1 (
    echo [错误] 构建失败！
    pause
    exit /b 1
)

echo.
echo [2/3] 启动游戏服务器...
start "GameServer" cmd /k "cd /d %~dp0 && node server/index.js"
timeout /t 4 /nobreak >/dev/null

echo.
echo [3/3] 启动 Cloudflare Tunnel...
echo    等待输出公网链接（约 30 秒）...
echo.
start "Tunnel" cmd /k "cloudflared tunnel --url http://localhost:8080"

echo ========================================
echo    服务器已启动！
echo    浏览器打开 http://localhost:8080
echo    或等 cloudflared 输出公网链接
echo ========================================
echo.
pause

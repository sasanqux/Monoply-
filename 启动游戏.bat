@echo off
cd /d "%~dp0"
echo 正在启动开发服务器（首次约需 10 秒）...
start http://localhost:5173
npx vite --port 5173 --host

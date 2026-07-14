@echo off
rem ============================================================
rem  Json2Mail desktop launcher
rem  Double-click to start the API + web servers and open the
rem  app in its own window. Press any key HERE to stop everything.
rem ============================================================
cd /d "%~dp0"

start "json2mail-api" /min cmd /k "cd api && php artisan serve"
start "json2mail-web" /min cmd /k "cd web && npm run dev"

echo Starting Json2Mail...

rem Wait until the web server answers (max ~30s), then open the app window
powershell -NoProfile -Command "for($i=0;$i -lt 30;$i++){try{(New-Object Net.Sockets.TcpClient('127.0.0.1',5173)).Close();exit 0}catch{Start-Sleep 1}};exit 1"

start "" msedge --app=http://localhost:5173

echo.
echo  Json2Mail is running.
echo  Press any key in THIS window to stop the servers and quit.
pause >nul

taskkill /fi "WINDOWTITLE eq json2mail-api*" /t /f >nul 2>&1
taskkill /fi "WINDOWTITLE eq json2mail-web*" /t /f >nul 2>&1

@echo off
title Munchbox Launcher
cd /d "%~dp0"
echo ============================================================
echo   Bringing Munchbox online...
echo   Runs hidden in the background - no windows to keep open.
echo   You can close this window, and VSCode, and it stays up.
echo ============================================================
echo.

echo Stopping any old copies...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0munchbox-stop.ps1"
"%SystemRoot%\System32\timeout.exe" /t 3 /nobreak >nul

echo Starting the supervisor...
start "" wscript.exe "%~dp0munchbox-hidden.vbs"
"%SystemRoot%\System32\timeout.exe" /t 20 /nobreak >nul

echo.
"%SystemRoot%\System32\curl.exe" -s -o nul -w "  local server : HTTP %%{http_code}\n" http://localhost:5001/api/health

echo.
echo   Local install page : http://localhost:5001/download
echo   Admin dashboard    : http://localhost:5001/admin
echo.
echo   Public tunnel URL (Cloudflare quick tunnel - changes each start):
if exist "%~dp0logs\tunnel-url.txt" (
  type "%~dp0logs\tunnel-url.txt"
) else (
  echo   ...not ready yet, check logs\tunnel-url.txt in a few seconds.
)
echo.
echo   The installed apps do NOT need this tunnel - they talk to the
echo   always-on Render URL. The tunnel is for testing local changes
echo   from a phone that is not on this WiFi.
echo.
echo   To go down : stop-munchbox.bat
echo.
echo   For Munchbox to come back by itself after a restart,
echo   run install-autostart.bat once.
pause

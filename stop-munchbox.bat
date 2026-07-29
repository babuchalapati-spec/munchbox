@echo off
cd /d "%~dp0"

REM ============================================================
REM  Takes the local Munchbox server OFFLINE.
REM  Stops the supervisor, the API server and this project's tunnel.
REM  Another project's ngrok tunnel is left alone.
REM
REM  The apps keep working: they fall back to the Render URL.
REM  Autostart stays installed - run start-munchbox.bat, or just
REM  log in again, to bring the local server back.
REM ============================================================

echo Stopping Munchbox...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0munchbox-stop.ps1"

echo.
echo Munchbox local server is offline.
pause

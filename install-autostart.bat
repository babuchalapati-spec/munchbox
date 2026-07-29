@echo off
setlocal
cd /d "%~dp0"

REM ============================================================
REM  Makes the Munchbox local server stay online on its own.
REM
REM  Puts a launcher in the Windows Startup folder that runs the
REM  supervisor (munchbox-daemon.ps1) hidden at every login. Windows
REM  Explorer starts it, so the server and tunnel are NOT children
REM  of VSCode or any terminal - closing the editor, or the window
REM  you ran this from, leaves it online.
REM
REM  The supervisor also reloads your code as you save it:
REM    backend\src -^> API restarts
REM    pwa\src     -^> customer web app rebuilds
REM    admin\src   -^> admin dashboard rebuilds
REM
REM  Run this ONCE. Double-click is enough, no admin needed.
REM ============================================================

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "TIMEOUT=%SystemRoot%\System32\timeout.exe"
set "CURL=%SystemRoot%\System32\curl.exe"

echo Clearing any copies that are already running...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0munchbox-stop.ps1"
"%TIMEOUT%" /t 3 /nobreak >nul

echo Installing the startup launcher...
> "%STARTUP%\munchbox-autostart.bat" echo @echo off
>>"%STARTUP%\munchbox-autostart.bat" echo REM Auto-starts the Munchbox server + tunnel, hidden, at login.
>>"%STARTUP%\munchbox-autostart.bat" echo REM To stop auto-start: delete this file from the Startup folder.
>>"%STARTUP%\munchbox-autostart.bat" echo start "" wscript.exe "%~dp0munchbox-hidden.vbs"
if not exist "%STARTUP%\munchbox-autostart.bat" (
  echo.
  echo FAILED to write to the Startup folder. Nothing was changed.
  pause
  exit /b 1
)

echo Starting it now...
start "" wscript.exe "%~dp0munchbox-hidden.vbs"
"%TIMEOUT%" /t 20 /nobreak >nul

echo.
echo Checking that the server is up...
"%CURL%" -s -o nul -w "  local server : HTTP %%{http_code}\n" http://localhost:5001/api/health

echo.
echo ============================================================
echo   Done. Munchbox now runs in the background.
echo.
echo   Install page : http://localhost:5001/download
echo   Dashboard    : http://localhost:5001/admin
echo   Tunnel URL   : logs\tunnel-url.txt
echo.
echo   You can close VSCode and this window - it stays up.
echo   It also starts again by itself every time you log in.
echo.
echo   Logs       : logs\daemon.log , server.log , ngrok.log , build.*.log
echo   To go down : stop-munchbox.bat
echo ============================================================
pause

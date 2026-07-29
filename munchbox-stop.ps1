# Takes every Munchbox process down, in the right order.
#
# Shared by stop-munchbox.bat and install-autostart.bat. Killing by port alone is not
# enough: the API runs under nodemon, so killing the node process listening on 5001 just
# makes its nodemon parent start a fresh one. The supervisor has to go first, then
# nodemon, then whatever is still holding the port.
#
# Note the tunnel step: it matches only the agent this project started. Another ngrok
# agent may be running for a different project on this machine, and taking that one down
# would quietly break someone else's live site.

$ErrorActionPreference = 'SilentlyContinue'
$Root = $PSScriptRoot

function Stop-Matching($label, $pattern) {
  $procs = Get-CimInstance Win32_Process |
           Where-Object { $_.CommandLine -like $pattern }
  foreach ($p in $procs) {
    Write-Host "  stopping $label (PID $($p.ProcessId))"
    Stop-Process -Id $p.ProcessId -Force
  }
}

# 1. The supervisor, or it restarts everything below.
Stop-Matching 'supervisor' '*munchbox-daemon.ps1*'

# 2. nodemon, or it respawns the API.
Stop-Matching 'nodemon' '*nodemon\bin\nodemon.js*'

# 3. Any leftover API / build process started from this project folder.
Stop-Matching 'api'   "*$Root\backend*"
Stop-Matching 'build' "*$Root\pwa*"
Stop-Matching 'build' "*$Root\admin*"

# 4. This project's tunnel only - matched on the local port it forwards to, not on the
#    process name. Another project runs its own tunnel agent on this machine and taking
#    that one down would quietly break someone else's live site.
Stop-Matching 'tunnel' '*--url*http://localhost:5001*'
Stop-Matching 'tunnel' '*munchbox-ngrok.yml*'

# 5. Anything still listening on 5001, whatever started it.
Start-Sleep -Seconds 1
$owners = Get-NetTCPConnection -LocalPort 5001 -State Listen -ErrorAction SilentlyContinue |
          Select-Object -ExpandProperty OwningProcess -Unique
foreach ($processId in $owners) {
  Write-Host "  stopping stray listener on port 5001 (PID $processId)"
  Stop-Process -Id $processId -Force
}

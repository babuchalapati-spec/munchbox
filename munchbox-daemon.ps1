# Munchbox background supervisor.
#
# Keeps the API server and the ngrok tunnel alive independently of any terminal or
# editor, so closing VSCode doesn't take the server down. Modelled on the gowrisankar
# daemon; the differences are Munchbox's port (5001), its two web builds, and the
# tunnel URL discovery below.
#
# It also picks up code changes with no manual step:
#   - backend/src/**  -> nodemon restarts the API within a second of saving
#   - pwa/src/**      -> the customer web app is rebuilt into pwa/dist
#   - admin/src/**    -> the admin dashboard is rebuilt into admin/dist, which is what
#                        the Munchbox Admin APK loads, so an admin UI change reaches
#                        the phone on the next refresh with no new APK
#
# The APKs are NOT rebuilt here: an Android release build takes minutes and needs a
# version bump to be worth publishing. Run build-apks.ps1 when you want new APKs.
#
# If a child exits (crash, ngrok drop) it is restarted on the next tick.
# Output goes to logs\server.log, logs\ngrok.log, logs\build.log, logs\daemon.log.

$ErrorActionPreference = 'SilentlyContinue'

$Root       = $PSScriptRoot
$Logs       = Join-Path $Root 'logs'
$ApiDir     = Join-Path $Root 'backend'
$PwaDir     = Join-Path $Root 'pwa'
$AdminDir   = Join-Path $Root 'admin'
# The .js entry, not nodemon.cmd: launching the .cmd puts a cmd.exe wrapper in between,
# and this script would then track the wrapper's lifetime instead of nodemon's - so a
# still-running nodemon looks dead and gets started twice.
$Nodemon    = Join-Path $ApiDir 'node_modules\nodemon\bin\nodemon.js'
$Port       = 5001

# Which tunnel service to expose the local server through.
#
#   'cloudflare' - default. A quick tunnel needs no account and no reserved name, and any
#                  number can run at once. The URL is random and changes on every restart.
#   'ngrok'      - only usable with a reserved domain THIS account owns and nothing else
#                  is currently using. On the free plan an account gets exactly one such
#                  domain, and every endpoint it starts claims that same one - so a second
#                  concurrent ngrok tunnel fails with "endpoint is already online" rather
#                  than falling back to a random address. Set $TunnelUrl below to use it.
$TunnelProvider = 'cloudflare'

$Cloudflared = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
if (-not (Test-Path $Cloudflared)) { $Cloudflared = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source }

# The ngrok agent ships in tools\ so the project doesn't depend on what happens to be
# installed machine-wide. That matters here: ngrok refuses to connect when the agent is
# older than the account's minimum (the winget copy is 3.3.1, well below it) and winget
# has no newer build to upgrade to. Only fall back to PATH if tools\ is missing.
$Ngrok = Join-Path $PSScriptRoot 'tools\ngrok.exe'
if (-not (Test-Path $Ngrok)) { $Ngrok = (Get-Command ngrok -ErrorAction SilentlyContinue).Source }

# A reserved ngrok domain (e.g. 'https://munchbox.ngrok-free.dev') for the same public URL
# every time. Only meaningful when $TunnelProvider is 'ngrok'; getting one for this project
# needs a second free ngrok account or a paid plan, since this account's single free domain
# belongs to another project. Either way the live URL is written to logs\tunnel-url.txt.
$TunnelUrl  = ''

# ngrok's local dashboard, which is how the agent reports the URL it was actually given.
# Each concurrent agent needs its own port; 4040 is another project's. The port itself is
# set in munchbox-ngrok.yml, because the installed agent takes it as a config value and
# rejects it as a command-line flag.
$NgrokApi   = 4041

# The account config holds the authtoken; ours adds only the dashboard port. ngrok merges
# repeated --config flags left to right, so the secret stays out of the repo.
$NgrokUserConfig    = Join-Path $env:LOCALAPPDATA 'ngrok\ngrok.yml'
$NgrokProjectConfig = Join-Path $PSScriptRoot 'munchbox-ngrok.yml'

# Saving a file usually means more saves are coming. Wait for the source tree to go
# quiet for this long before spending time on a full rebuild.
$QuietSeconds = 6

New-Item -ItemType Directory -Force -Path $Logs | Out-Null

# Single instance only. Logging in while a daemon is already running (or double clicking
# the installer) must not start a second server fighting for port 5001.
$mutex = New-Object System.Threading.Mutex($false, 'Global\MunchboxDaemon')
if (-not $mutex.WaitOne(0)) { exit 0 }

function Write-Daemon($msg) {
  "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg" |
    Out-File -FilePath (Join-Path $Logs 'daemon.log') -Append -Encoding utf8
}

# Keep the previous run's output as .old so a crash can still be read after the restart
# has overwritten the live log.
function Get-RolledLog($name) {
  $file = Join-Path $Logs $name
  if (Test-Path $file) { Move-Item $file "$file.old" -Force }
  return $file
}

# Start-Process -PassThru hands back a Process object that has not opened a handle to the
# process. Reading .Handle once, here, forces it open - without that, .ExitCode later
# reads as $null and every clean exit looks like a crash.
function Start-Tracked($exe, $argList, $workDir, $outLog, $errLog) {
  $proc = Start-Process -FilePath $exe -ArgumentList $argList `
    -WorkingDirectory $workDir -NoNewWindow -PassThru `
    -RedirectStandardOutput (Get-RolledLog $outLog) `
    -RedirectStandardError  (Get-RolledLog $errLog)
  if ($proc) { $null = $proc.Handle }
  return $proc
}

function Start-Api {
  # nodemon, not plain node: it watches src/ and restarts on save, which is what makes a
  # backend edit go live without touching this daemon.
  Write-Daemon "starting API (nodemon src/server.js) on port $Port"
  Start-Tracked 'node' @("`"$Nodemon`"", 'src/server.js') $ApiDir 'server.log' 'server.err.log'
}

function Start-Tunnel {
  Write-Daemon "starting $TunnelProvider tunnel -> localhost:$Port"
  if ($TunnelProvider -eq 'ngrok') {
    $tunnelArgs = @('http', '--log=stdout', "--config=$NgrokUserConfig", "--config=$NgrokProjectConfig")
    # --domain, not --url: the installed agent spells the reserved-domain flag that way
    # and wants a bare hostname, so any scheme typed into $TunnelUrl is trimmed off here.
    if ($TunnelUrl) { $tunnelArgs += "--domain=$($TunnelUrl -replace '^https?://', '')" }
    $tunnelArgs += "$Port"
    return Start-Tracked $Ngrok $tunnelArgs $Root 'tunnel.log' 'tunnel.err.log'
  }
  Start-Tracked $Cloudflared @('tunnel', '--url', "http://localhost:$Port") $Root 'tunnel.log' 'tunnel.err.log'
}

# Asks the running agent what public URL it ended up with and records it, so a random
# free-plan URL can still be found without reading through the ngrok log by hand.
function Save-TunnelUrl {
  try {
    $url = $null
    if ($TunnelProvider -eq 'ngrok') {
      try {
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:$NgrokApi/api/tunnels" -TimeoutSec 5
        $url = ($res.tunnels | Where-Object { $_.proto -eq 'https' } | Select-Object -First 1).public_url
        if (-not $url) { $url = ($res.tunnels | Select-Object -First 1).public_url }
      } catch { }
    }

    # Otherwise (and as a fallback for ngrok) read it out of the agent's own log. Both
    # agents print the public address when the tunnel comes up; cloudflared has no local
    # API to ask, so for a quick tunnel this is the only way to learn the URL at all.
    # cloudflared logs to stderr, ngrok to stdout, so both files are searched.
    if (-not $url) {
      foreach ($name in @('tunnel.err.log', 'tunnel.log')) {
        $log = Join-Path $Logs $name
        if (-not (Test-Path $log)) { continue }
        $match = Select-String -Path $log -Pattern '(https://[a-z0-9-]+\.(?:trycloudflare\.com|ngrok-free\.dev|ngrok\.app|ngrok\.io))' -AllMatches |
                 Select-Object -Last 1
        if ($match) { $url = $match.Matches[-1].Groups[1].Value; break }
      }
    }

    if ($url) {
      $file = Join-Path $Logs 'tunnel-url.txt'
      $existing = if (Test-Path $file) { (Get-Content $file -Raw).Trim() } else { '' }
      if ($existing -ne $url) {
        $url | Out-File -FilePath $file -Encoding utf8
        Write-Daemon "tunnel is live at $url"
      }
      return $url
    }
  } catch { }
  return $null
}

function Start-Build($dir, $label) {
  Write-Daemon "$label change detected - rebuilding"
  Start-Tracked 'npm.cmd' @('run', 'build') $dir "build.$label.log" "build.$label.err.log"
}

# Newest write time across everything a built web app is compiled from.
function Get-Stamp($dir) {
  $paths = @(
    (Join-Path $dir 'src'),
    (Join-Path $dir 'public'),
    (Join-Path $dir 'index.html'),
    (Join-Path $dir 'vite.config.js')
  ) | Where-Object { Test-Path $_ }

  if (-not $paths) { return [datetime]::MinValue }
  $newest = Get-ChildItem -Path $paths -Recurse -File |
            Sort-Object LastWriteTimeUtc -Descending |
            Select-Object -First 1
  if ($newest) { return $newest.LastWriteTimeUtc } else { return [datetime]::MinValue }
}

if ($TunnelProvider -eq 'ngrok' -and (-not $Ngrok -or -not (Test-Path $Ngrok))) {
  Write-Daemon 'FATAL: ngrok.exe not found'; exit 1
}
if ($TunnelProvider -eq 'cloudflare' -and (-not $Cloudflared -or -not (Test-Path $Cloudflared))) {
  Write-Daemon 'FATAL: cloudflared.exe not found'; exit 1
}
if (-not (Test-Path $Nodemon)) { Write-Daemon "FATAL: nodemon not found - run 'npm install' in backend\"; exit 1 }

Write-Daemon '--- daemon started ---'

$api = $null
$tun = $null

# One build slot per web app, so an admin rebuild doesn't block a pwa one.
$sites = @(
  @{ Name = 'pwa';   Dir = $PwaDir },
  @{ Name = 'admin'; Dir = $AdminDir }
)
# Treat whatever is on disk right now as already built, so starting the daemon does not
# trigger a rebuild of unchanged code.
foreach ($s in $sites) {
  $stamp = Get-Stamp $s.Dir
  $s.Built   = $stamp
  $s.Seen    = $stamp
  $s.SeenAt  = Get-Date
  $s.Proc    = $null
}

while ($true) {

  # --- keep the API up -------------------------------------------------
  if ($null -eq $api -or $api.HasExited) {
    if ($api) { Write-Daemon "API exited (code $($api.ExitCode)), restarting" }
    $api = Start-Api
    # Let the API bind the port before ngrok tries to forward to it.
    Start-Sleep -Seconds 5
  }

  # --- keep the tunnel up ----------------------------------------------
  if ($null -eq $tun -or $tun.HasExited) {
    if ($tun) { Write-Daemon "tunnel exited (code $($tun.ExitCode)), restarting" }
    $tun = Start-Tunnel
    Start-Sleep -Seconds 4
  }

  # Every tick, not just after a restart: the agent can take longer than the pause above
  # to report its address, and checking once would leave tunnel-url.txt empty until the
  # next crash. Save-TunnelUrl only writes when the URL actually changes.
  Save-TunnelUrl | Out-Null

  # --- rebuild each web app when its source changes ---------------------
  foreach ($s in $sites) {
    if ($s.Proc -and $s.Proc.HasExited) {
      # WaitForExit on an already-exited process returns at once, but it is what
      # materialises ExitCode - without it npm's wrapper reports $null and every
      # successful build looks like a failure.
      $s.Proc.WaitForExit()
      $code = $s.Proc.ExitCode
      if ($code -eq 0) {
        Write-Daemon "$($s.Name) rebuild finished - new UI is live"
      } else {
        Write-Daemon "$($s.Name) rebuild FAILED (code $code) - see logs\build.$($s.Name).err.log"
      }
      # Either way, record what was built so one broken save does not put the daemon
      # into a rebuild loop. The next save retries.
      $s.Built = $s.Seen
      $s.Proc  = $null
    }

    $stamp = Get-Stamp $s.Dir
    if ($stamp -gt $s.Seen) {
      # Still being edited - restart the quiet timer.
      $s.Seen   = $stamp
      $s.SeenAt = Get-Date
    }
    elseif ($null -eq $s.Proc -and $s.Seen -gt $s.Built -and
            ((Get-Date) - $s.SeenAt).TotalSeconds -ge $QuietSeconds) {
      $s.Proc = Start-Build $s.Dir $s.Name
    }
  }

  Start-Sleep -Seconds 4
}

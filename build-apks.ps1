# Builds all four Munchbox apps and publishes them to the download page.
#
# One Gradle run produces four release APKs (customer, partner, shop, admin) from the
# product flavors in mobile\android\app\build.gradle. Each is copied into
# backend\downloads under the filename /api/app/version advertises, which is what the
# install page links to and what the in-app update check downloads.
#
#   .\build-apks.ps1              # all four
#   .\build-apks.ps1 -Only partner
#
# Remember to bump versionCode in mobile\android\app\build.gradle AND APP_VERSION_CODE
# in mobile\src\updateCheck.js before a release, or installed apps won't see the update.

param(
  [ValidateSet('all', 'customer', 'partner', 'shop', 'admin')]
  [string]$Only = 'all'
)

$ErrorActionPreference = 'Stop'

$Root      = $PSScriptRoot
$AndroidDir = Join-Path $Root 'mobile\android'
$Downloads  = Join-Path $Root 'backend\downloads'

# flavor -> the APK filename the backend serves for that app.
$FLAVORS = [ordered]@{
  customer = 'Munchbox.apk'
  partner  = 'MunchboxPartner.apk'
  shop     = 'MunchboxShop.apk'
  admin    = 'MunchboxAdmin.apk'
}

$targets = if ($Only -eq 'all') { $FLAVORS.Keys } else { @($Only) }

New-Item -ItemType Directory -Force -Path $Downloads | Out-Null

# Capitalised flavor name is what Gradle's task is called: assembleCustomerRelease.
function Get-AssembleTask($flavor) {
  $name = $flavor.Substring(0,1).ToUpper() + $flavor.Substring(1)
  return "assemble${name}Release"
}

$tasks = @($targets | ForEach-Object { Get-AssembleTask $_ })

Write-Host "Building: $($targets -join ', ')" -ForegroundColor Cyan
Write-Host "This takes a few minutes." -ForegroundColor DarkGray

Push-Location $AndroidDir
try {
  & (Join-Path $AndroidDir 'gradlew.bat') @tasks
  if ($LASTEXITCODE -ne 0) { throw "Gradle failed with exit code $LASTEXITCODE" }
} finally {
  Pop-Location
}

foreach ($flavor in $targets) {
  # Gradle writes to outputs\apk\<flavor>\release\app-<flavor>-release.apk
  $built = Join-Path $AndroidDir "app\build\outputs\apk\$flavor\release\app-$flavor-release.apk"
  if (-not (Test-Path $built)) {
    Write-Warning "Expected APK not found for $flavor at $built"
    continue
  }
  $target = Join-Path $Downloads $FLAVORS[$flavor]
  Copy-Item $built $target -Force
  $sizeMb = [math]::Round((Get-Item $target).Length / 1MB, 1)
  Write-Host ("  published {0,-22} {1} MB" -f $FLAVORS[$flavor], $sizeMb) -ForegroundColor Green
}

Write-Host ''
Write-Host 'Done. The install page now serves the new builds:' -ForegroundColor Cyan
Write-Host '  local  : http://localhost:5001/download'
Write-Host '  public : https://nirman-4vyy.onrender.com/download'
Write-Host ''
Write-Host 'Note: backend\downloads is gitignored, so a Render deploy does not carry these' -ForegroundColor DarkGray
Write-Host 'APKs. Upload them once from the dashboard: Admin > Settings > Publish APK.' -ForegroundColor DarkGray

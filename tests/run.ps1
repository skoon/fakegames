<#
.SYNOPSIS
  Runs the arcade test suites in headless Chrome.

.DESCRIPTION
  Several games keep their JavaScript inline in a <script> block, so this script
  first extracts that source into tests/.build/, then loads one page per game in
  headless Chrome and reads the assertion report back out of the DOM.

  One page per game on purpose: the games share top-level names (score, lives,
  player, canvas, ctx, update...) and would collide if loaded together.

.EXAMPLE
  pwsh tests/run.ps1
  powershell -File tests\run.ps1
#>

[CmdletBinding()]
param(
  # Run only suites whose page name matches this (e.g. -Only tempest).
  [string]$Only = ""
)

$ErrorActionPreference = "Stop"

$testsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir  = Split-Path -Parent $testsDir
$buildDir = Join-Path $testsDir ".build"

# ---------------------------------------------------------------- find Chrome

function Find-Chrome {
  $candidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
  )
  foreach ($c in $candidates) {
    if ($c -and (Test-Path $c)) { return $c }
  }
  $cmd = Get-Command chrome -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  throw "No Chrome or Edge found. Install one, or edit Find-Chrome in tests/run.ps1."
}

# ------------------------------------------------- extract inline game source

function Export-InlineScript {
  param([string]$HtmlPath, [string]$OutPath)

  $html = Get-Content -Raw -Path $HtmlPath
  # Only bare <script> blocks; <script src="..."> is left alone.
  $m = [regex]::Match($html, '(?s)<script>\s*(.*?)\s*</script>')
  if (-not $m.Success) {
    throw "No inline <script> block found in $HtmlPath"
  }
  [IO.File]::WriteAllText($OutPath, $m.Groups[1].Value, [Text.Encoding]::UTF8)
}

function Build-Sources {
  if (Test-Path $buildDir) { Remove-Item -Recurse -Force $buildDir }
  New-Item -ItemType Directory -Path $buildDir | Out-Null

  # Games with a separate .js file are copied as-is.
  $standalone = @{
    "digdug.js"    = "fakedigdug\js\game.js"
    "spyhunter.js" = "fakespyhunter\game.js"
  }
  foreach ($name in $standalone.Keys) {
    Copy-Item (Join-Path $rootDir $standalone[$name]) (Join-Path $buildDir $name)
  }

  # Games with inline source are extracted.
  $inline = @{
    "tempest.js"       = "faketempest\faketempest.html"
    "spaceinvaders.js" = "fakespaceinvaders\fakespaceinvaders.html"
    "poleposition.js"  = "fakepoleposition\fakepoleposition.html"
    "breakout.js"      = "fakebreakout\fakebreakout.html"
    "asteroids.js"     = "fakeasteroids\fakeasteroids.html"
  }
  foreach ($name in $inline.Keys) {
    Export-InlineScript -HtmlPath (Join-Path $rootDir $inline[$name]) `
                        -OutPath  (Join-Path $buildDir $name)
  }
}

# --------------------------------------------------------------- run one page

function Invoke-Page {
  param([string]$Chrome, [string]$PagePath)

  $uri = ([Uri]$PagePath).AbsoluteUri
  $profileDir = Join-Path $buildDir "chrome-profile"

  # Chrome writes warnings to stderr, and PowerShell turns native stderr into
  # error records - which $ErrorActionPreference='Stop' then throws on, even
  # when the run succeeded. Relax it just around the call.
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $raw = & $Chrome `
    --headless=new --disable-gpu --no-sandbox --no-first-run `
    --virtual-time-budget=8000 `
    --user-data-dir="$profileDir" `
    --dump-dom $uri 2>$null | Out-String
  $ErrorActionPreference = $prev

  $m = [regex]::Match($raw, '(?s)@@START@@\r?\n(.*?)\r?\n@@END@@')
  if (-not $m.Success) {
    return @{ Ok = $false; Text = "  no report produced - the page threw before it could render results" }
  }
  $text = $m.Groups[1].Value -replace '&lt;', '<' -replace '&gt;', '>' -replace '&amp;', '&'
  return @{ Ok = ($text -notmatch 'FAIL|THREW'); Text = $text }
}

# --------------------------------------------------------------------- driver

$chrome = Find-Chrome
Write-Host "browser: $chrome"
Build-Sources

# pages/ runs games against stubs; integration/ runs them against real Phaser
# and real key events, which is the seam the stubs cannot reach.
$pages = @()
$pages += Get-ChildItem (Join-Path $testsDir "pages") -Filter *.html | Sort-Object Name
$integrationDir = Join-Path $testsDir "integration"
if (Test-Path $integrationDir) {
  $pages += Get-ChildItem $integrationDir -Filter *.html | Sort-Object Name
}

if ($Only -ne "") {
  $pages = $pages | Where-Object { $_.BaseName -like "*$Only*" -or $_.Directory.Name -like "*$Only*" }
}
if (-not $pages) { throw "No test pages matched." }

$failed = 0
foreach ($page in $pages) {
  Write-Host ""
  $label = $page.BaseName
  if ($page.Directory.Name -eq "integration") {
    $label = "$label (e2e, real phaser)"
  }
  Write-Host $label -ForegroundColor Cyan
  $result = Invoke-Page -Chrome $chrome -PagePath $page.FullName
  Write-Host $result.Text
  if (-not $result.Ok) { $failed++ }
}

Write-Host ""
if ($failed -eq 0) {
  Write-Host "all suites passed" -ForegroundColor Green
  exit 0
} else {
  Write-Host "$failed suite(s) failed" -ForegroundColor Red
  exit 1
}

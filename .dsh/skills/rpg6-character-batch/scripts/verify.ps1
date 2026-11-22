param(
  [string]$Plan = "",
  [switch]$Browser,
  [switch]$SkipBrowser,
  [switch]$Full,
  [switch]$SkipCheck
)

# ASCII only: Windows PowerShell 5.1 reads UTF-8 without BOM as ANSI, non-ASCII
# comments would corrupt the script. Messages live in the node scripts.
$ErrorActionPreference = "Stop"
$scripts = $PSScriptRoot
$root = (Resolve-Path (Join-Path $scripts "..\..\..\..")).Path

. (Join-Path $root "tools\node.ps1")
$node = Get-NodeExe
if (-not $node) {
  Write-Error "node not found; check tools/node.ps1"
  exit 2
}

function Invoke-Step([string]$Name, [scriptblock]$Block) {
  Write-Host ""
  Write-Host "== $Name ==" -ForegroundColor Cyan
  & $Block
  $code = $LASTEXITCODE
  if ($code -ne 0) {
    Write-Host "FAILED: $Name (exit $code)" -ForegroundColor Red
    exit $code
  }
}

# 1. plan check: --mode=verify accepts characters already in the library.
if ($Plan) {
  $planPath = (Resolve-Path $Plan).Path
  Invoke-Step "plan check" { & $node (Join-Path $scripts "plan.mjs") --check $planPath --mode=verify }
}

# 2. engine tests
Invoke-Step "engine tests" { & $node (Join-Path $root "tests\engine\run.mjs") }

# 3. stress: smoke by default, -Full for 4 seeds
if ($Full) {
  Invoke-Step "batch full" { & $node (Join-Path $root "tests\engine\batch.mjs") --seeds=4 }
} else {
  Invoke-Step "batch smoke" { & $node (Join-Path $root "tests\engine\batch.mjs") --pairs=smoke --seeds=1 }
}

# 4. repo gates: encoding, lint, doc numbers, biome, gitleaks (full history)
if (-not $SkipCheck) {
  Invoke-Step "repo check" { & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "tools\check.ps1") }
}

# 5. browser group: only when the battle page, skills, summons or css changed.
#    Print an explicit skip line so a missing run never looks like a pass.
$runBrowser = $Browser -and -not $SkipBrowser
if ($runBrowser) {
  $group = -join ([char]0x56DE, [char]0x5408, [char]0x5236)
  Invoke-Step "browser tests" { & $node (Join-Path $root "_local\tests\run-all.mjs") --group=$group }
} else {
  Write-Host ""
  Write-Host "SKIP browser group: add -Browser when rpg6.0/js/battle, css, test.html or skill effects changed" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "ALL PASSED" -ForegroundColor Green
exit 0

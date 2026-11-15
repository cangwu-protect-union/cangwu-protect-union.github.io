param(
  [string]$Plan = "",
  [switch]$SkipBrowser,
  [switch]$Full
)

$ErrorActionPreference = "Stop"
$scripts = $PSScriptRoot
$root = (Resolve-Path (Join-Path $scripts "..\..\..\..")).Path

$node = (Get-ChildItem "$env:USERPROFILE\.dsh\dsh-runtimes\*\dependencies\node\bin\node.exe" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
if (-not $node) {
  $node = (Get-Command node -ErrorAction SilentlyContinue).Source
}
if (-not $node) {
  Write-Error "node not found; check the bundled node path"
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

if ($Plan) {
  $planPath = (Resolve-Path $Plan).Path
  Invoke-Step "plan check" { & $node (Join-Path $scripts "plan.mjs") --check $planPath }
}

Invoke-Step "engine tests" { & $node (Join-Path $root "_local\tests\engine\run.mjs") }

if ($Full) {
  Invoke-Step "batch full" { & $node (Join-Path $root "_local\tests\engine\batch.mjs") --seeds=4 }
} else {
  Invoke-Step "batch smoke" { & $node (Join-Path $root "_local\tests\engine\batch.mjs") --pairs=smoke --seeds=1 }
}

if (-not $SkipBrowser) {
  $group = -join ([char]0x56DE, [char]0x5408, [char]0x5236)
  Invoke-Step "browser tests" { & $node (Join-Path $root "_local\tests\run-all.mjs") --group=$group }
}

Invoke-Step "repo check" { & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "tools\check.ps1") }
Invoke-Step "docs count audit" { & $node (Join-Path $scripts "audit-docs.mjs") }

Write-Host ""
Write-Host "ALL PASSED" -ForegroundColor Green
exit 0

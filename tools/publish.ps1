param(
  [Parameter(Mandatory = $true)][string]$Message,
  [string]$Url = "",
  [string]$Expect = ""
)

# One command: staged check -> commit -> push -> post-commit secret scan -> optional live poll.
# ASCII only (Windows PowerShell 5.1 reads UTF-8 without BOM as ANSI).
# Usage:
#   powershell -File tools\publish.ps1 -Message _local\tmp\msg.txt
#   powershell -File tools\publish.ps1 -Message msg.txt -Url https://example.github.io/page.html -Expect "new text"

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
. (Join-Path $root "tools\node.ps1")
$node = Get-NodeExe
if (-not $node) {
  Write-Error "node not found; check tools/node.ps1"
  exit 2
}
if (-not (Test-Path -LiteralPath $Message)) {
  Write-Error "commit message file not found: $Message"
  exit 2
}
$msgPath = (Resolve-Path -LiteralPath $Message).Path

Push-Location $root
try {
  $dirty = @(git status --porcelain)
  if ($dirty.Count -gt 0) {
    # Stage first: -Staged checks (secret scan, staged-file list, engine version guard)
    # only look at the index, so running them before "git add" would check nothing.
    git add -A
    if ($LASTEXITCODE -ne 0) {
      Write-Host "git add failed" -ForegroundColor Red
      exit 1
    }
    Write-Host "== pre-commit check (-Staged) ==" -ForegroundColor Cyan
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "tools\check.ps1") -Staged
    if ($LASTEXITCODE -ne 0) {
      git reset -q
      Write-Host "pre-commit check failed; changes are unstaged, nothing committed" -ForegroundColor Red
      exit 1
    }
    # The pre-commit hook runs exactly the same -Staged check; skip the duplicate run.
    git commit -q --no-verify -F $msgPath
    if ($LASTEXITCODE -ne 0) {
      Write-Host "git commit failed" -ForegroundColor Red
      exit 1
    }
    Write-Host ("committed " + (git rev-parse --short HEAD)) -ForegroundColor Green
  } else {
    Write-Host "working tree clean; only pushing" -ForegroundColor DarkGray
  }

  $env:GIT_TERMINAL_PROMPT = "0"
  $pushed = $false
  for ($i = 1; $i -le 8; $i++) {
    $out = @(git push origin main 2>&1)
    if ($LASTEXITCODE -eq 0) { $pushed = $true; break }
    # The proxy sometimes hangs mid-upload; HTTP/1.1 with a large postBuffer gets through.
    if (($out -join "`n") -match "Pushing to") {
      $out2 = @(git -c http.postBuffer=104857600 -c http.version=HTTP/1.1 push origin main 2>&1)
      if ($LASTEXITCODE -eq 0) { $pushed = $true; break }
    }
    Start-Sleep -Seconds 6
  }
  if (-not $pushed) {
    Write-Host "push failed after retries" -ForegroundColor Red
    exit 1
  }
  Write-Host ("pushed " + (git rev-parse --short HEAD)) -ForegroundColor Green

  Write-Host "== post-commit check (-Last) ==" -ForegroundColor Cyan
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "tools\check.ps1") -Last
  if ($LASTEXITCODE -ne 0) { exit 1 }

  if ($Url -and $Expect) {
    Write-Host "== wait for deployment ==" -ForegroundColor Cyan
    & $node --use-system-ca (Join-Path $root "tools\poll-live.mjs") $Url $Expect
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
} finally {
  Pop-Location
}

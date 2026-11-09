# tools/check.ps1 -- one entry point for all project checks.
# ASCII only on purpose: Windows PowerShell 5.1 reads UTF-8 without BOM as ANSI,
# so non-ASCII text in a .ps1 would turn into mojibake. Messages live in check.js.
#
# Usage:  powershell -ExecutionPolicy Bypass -File tools\check.ps1
#         powershell -ExecutionPolicy Bypass -File tools\check.ps1 -Staged
param([switch]$Staged)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$failed = 0

function Find-Node {
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $cands = @()
    $cands += Get-ChildItem "$env:USERPROFILE\.dsh\dsh-runtimes\*\dependencies\node\bin\node.exe" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -ExpandProperty FullName
    $cands += 'C:\Program Files\nodejs\node.exe'
    foreach ($c in $cands) { if ($c -and (Test-Path $c)) { return $c } }
    return $null
}

function Find-Tool([string]$name) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    foreach ($p in @("$root\_local\bin\$name.exe", "$root\_local\bin\$name")) {
        if (Test-Path $p) { return $p }
    }
    return $null
}

Write-Host '=== project check ===' -ForegroundColor Cyan

$node = Find-Node
if (-not $node) {
    Write-Host 'node not found. Install Node.js LTS or keep the DSH bundled runtime.' -ForegroundColor Red
    exit 2
}

# Every later step assumes the project root is the working directory,
# so that biome/gitleaks pick up their configs regardless of where check.ps1 was called from.
Push-Location $root
try {
    $args2 = @("$root\tools\check.js")
    if ($Staged) { $args2 += '--staged' }
    & $node @args2
    if ($LASTEXITCODE -ne 0) { $failed++ }

    # Generated docs must match the source. _local/ is gitignored, so skip when absent.
    $docs = "$root\_local\tools\build-docs.js"
    if (Test-Path $docs) {
        Write-Host '--- docs freshness ---' -ForegroundColor Cyan
        & $node $docs --check
        if ($LASTEXITCODE -ne 0) { $failed++ }
    } else {
        Write-Host '--- docs freshness: build-docs.js not found, skipped ---' -ForegroundColor DarkGray
    }

    $biome = Find-Tool 'biome'
    if ($biome -and (Test-Path "$root\biome.json")) {
        Write-Host '--- biome ---' -ForegroundColor Cyan
        & $biome check --max-diagnostics=100
        if ($LASTEXITCODE -ne 0) { $failed++ }
    } else {
        Write-Host '--- biome: not installed, skipped ---' -ForegroundColor DarkGray
    }

    $gitleaks = Find-Tool 'gitleaks'
    if ($gitleaks) {
        Write-Host '--- gitleaks ---' -ForegroundColor Cyan
        # 只扫 git 历史，不扫工作区：_local/ 里本来就有密码，dir 模式必然报一堆无关的
        if ($Staged) { & $gitleaks git --pre-commit --staged --redact --no-banner }
        else { & $gitleaks git --redact --no-banner }
        if ($LASTEXITCODE -ne 0) { $failed++ }
    } else {
        Write-Host '--- gitleaks: not installed, skipped ---' -ForegroundColor DarkGray
    }
} finally {
    Pop-Location
}

Write-Host ''
if ($failed -gt 0) {
    Write-Host "FAILED: $failed step(s)" -ForegroundColor Red
    exit 1
}
Write-Host 'ALL CHECKS PASSED' -ForegroundColor Green
exit 0

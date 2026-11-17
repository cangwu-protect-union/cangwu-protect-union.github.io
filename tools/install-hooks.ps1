# tools/install-hooks.ps1 -- install the pre-commit hook that runs check.ps1 -Staged.
#
# ASCII only on purpose: Windows PowerShell 5.1 reads UTF-8 without BOM as ANSI.
#
# .git/hooks is not versioned, so the hook has to be installed per clone:
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\install-hooks.ps1
#
# The hook blocks a commit when check.ps1 -Staged fails: skill library lint, doc
# numbers, staged _local/ or SQL files, gitleaks on the staged diff, and the
# engine version guard (engine rule file changed but ENGINE_VERSION did not).

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$gitDir = Join-Path $root '.git'
if (-not (Test-Path $gitDir)) {
    Write-Host "no .git under $root -- run this from a clone" -ForegroundColor Red
    exit 1
}
$hooks = Join-Path $gitDir 'hooks'
if (-not (Test-Path $hooks)) { New-Item -ItemType Directory -Path $hooks | Out-Null }

$hookPath = Join-Path $hooks 'pre-commit'
$lines = @(
    '#!/bin/sh',
    '# Installed by tools/install-hooks.ps1 -- runs the same checks as check.ps1 -Staged.',
    '# Skip once with: DSH_SKIP_ENGINE_VERSION_GUARD=1 (version guard only) or --no-verify (everything).',
    'root=$(git rev-parse --show-toplevel) || exit 1',
    'powershell -NoProfile -ExecutionPolicy Bypass -File "$root/tools/check.ps1" -Staged',
    ''
)
$content = ($lines -join "`n")
# git runs hooks through sh, so the file must be LF only and executable.
[System.IO.File]::WriteAllText($hookPath, $content, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "installed $hookPath" -ForegroundColor Green
Write-Host 'every commit now runs: node tools/check.js --staged, biome, gitleaks, doc numbers, skill lint, engine version guard'
Write-Host 'remove it with: Remove-Item .git\hooks\pre-commit'

# tools/check.ps1 -- one entry point for all project checks.
# ASCII only on purpose: Windows PowerShell 5.1 reads UTF-8 without BOM as ANSI,
# so non-ASCII text in a .ps1 would turn into mojibake. Messages live in check.js.
#
# Usage:  powershell -ExecutionPolicy Bypass -File tools\check.ps1
#         powershell -ExecutionPolicy Bypass -File tools\check.ps1 -Staged
#         powershell -ExecutionPolicy Bypass -File tools\check.ps1 -Last    (after commit: secrets in the new commit only)
param([switch]$Staged, [switch]$Last)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$failed = 0
. "$root\tools\node.ps1"

function Find-Tool([string]$name) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    foreach ($p in @("$root\_local\bin\$name.exe", "$root\_local\bin\$name")) {
        if (Test-Path $p) { return $p }
    }
    return $null
}

# Read ENGINE_VERSION out of a git revision of version.js (':path' = index, 'HEAD:path' = last commit).
function Get-EngineVersion([string]$rev) {
    $text = & git show "${rev}" 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $text) { return '' }
    $m = [regex]::Match(($text -join "`n"), 'ENGINE_VERSION\s*=\s*"([^"]+)"')
    if ($m.Success) { return $m.Groups[1].Value }
    return ''
}

# Rule files decide battle outcomes; if one is staged without a version bump, old records replay wrong.
# Returns $true when the guard fails.
function Test-EngineVersionGuard {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Host 'engine version guard: git not found, skipped' -ForegroundColor DarkGray
        return $false
    }
    $inside = (& git rev-parse --is-inside-work-tree 2>$null)
    if ($inside -ne 'true') {
        Write-Host 'engine version guard: not a git repo, skipped' -ForegroundColor DarkGray
        return $false
    }
    $staged = @(& git diff --cached --name-only 2>$null)
    $rules = @($staged | Where-Object { $_ -match '^rpg6\.0/js/engine/(rules|damage|state|effect-ops(?:-[a-z0-9-]+)?|skills|timeline|actions|conditions|summons|traits)\.js$' })
    if ($rules.Count -eq 0) {
        Write-Host 'engine version guard: no engine rule file staged, ok' -ForegroundColor DarkGray
        return $false
    }
    $newVersion = Get-EngineVersion ':rpg6.0/js/engine/version.js'
    $oldVersion = Get-EngineVersion 'HEAD:rpg6.0/js/engine/version.js'
    if ($newVersion -and $newVersion -ne $oldVersion) {
        Write-Host "engine version guard: ENGINE_VERSION $oldVersion -> $newVersion, ok" -ForegroundColor DarkGray
        return $false
    }
    Write-Host 'engine version guard: engine rule files staged but ENGINE_VERSION unchanged' -ForegroundColor Red
    foreach ($f in $rules) { Write-Host "  staged: $f" -ForegroundColor Red }
    Write-Host '  bump rpg6.0/js/engine/version.js (and data/config.js), or rerun with DSH_SKIP_ENGINE_VERSION_GUARD=1 when settlement cannot change' -ForegroundColor Yellow
    return $true
}

Write-Host '=== project check ===' -ForegroundColor Cyan

# Post-commit mode: only the new commit can contain secrets that the working tree pass missed.
# Everything else was already checked before the commit.
if ($Last) {
    $gitleaksLast = Find-Tool 'gitleaks'
    if (-not $gitleaksLast) {
        Write-Host 'gitleaks: not installed, skipped' -ForegroundColor DarkGray
        exit 0
    }
    Push-Location $root
    try {
        & $gitleaksLast git --log-opts=-1 --redact --no-banner
        if ($LASTEXITCODE -ne 0) {
            Write-Host 'FAILED: the last commit has leaks' -ForegroundColor Red
            exit 1
        }
    } finally {
        Pop-Location
    }
    Write-Host 'POST-COMMIT CHECK PASSED' -ForegroundColor Green
    exit 0
}

$node = Get-NodeExe
if (-not $node) {
    Write-Host 'node not found. Install Node.js LTS or keep the DSH bundled runtime.' -ForegroundColor Red
    exit 2
}

# Every later step assumes the project root is the working directory,
# so that biome/gitleaks pick up their configs regardless of where check.ps1 was called from.
Push-Location $root
try {
    & $node "$root\tools\check.js"
    if ($LASTEXITCODE -ne 0) { $failed++ }

    # Repo hygiene, size gate and staged-file checks.
    # node cannot spawn a child process under the DSH file sandbox (EPERM), so git work
    # happens here, where PowerShell can call git and read the output. Keeping it in
    # check.js made these three checks silently no-op and still print a clean pass.
    $trackedRaw = (@(& git -c core.quotepath=false ls-files -z 2>$null) -join '')
    $trackedFiles = @()
    if ($trackedRaw) { $trackedFiles = @($trackedRaw -split "`0" | Where-Object { $_ }) }

    if ($trackedFiles.Count -eq 0) {
        Write-Host '--- repo hygiene / size gate: git unavailable, skipped ---' -ForegroundColor DarkGray
    } else {
        Write-Host '--- repo hygiene ---' -ForegroundColor Cyan
        $repoBad = 0
        foreach ($p in $trackedFiles) {
            if ($p -match '^(?:_local|node_modules|\.pnpm-store)/' -or $p -match '\.(?:sql|docx|xlsx|zip|7z|log)$') {
                Write-Host "  tracked but must stay ignored: $p" -ForegroundColor Red
                $repoBad++
            }
        }
        if ($repoBad -gt 0) { $failed++ } else { Write-Host 'repo hygiene: ok' -ForegroundColor DarkGray }

        Write-Host '--- size gate ---' -ForegroundColor Cyan
        $sizeLimit = 40960
        $sizeExt = @('.js', '.mjs', '.css', '.html', '.htm', '.md', '.ps1')
        $overSize = 0
        foreach ($p in $trackedFiles) {
            if ($sizeExt -notcontains [System.IO.Path]::GetExtension($p).ToLowerInvariant()) { continue }
            if ($p -like 'guitu/js/lib/*' -or $p -like 'quyu/vendor/*') { continue }
            $full = Join-Path $root $p
            if (-not (Test-Path -LiteralPath $full)) { continue }
            $len = (Get-Item -LiteralPath $full).Length
            if ($len -gt $sizeLimit) {
                Write-Host "  over $sizeLimit bytes ($len): $p" -ForegroundColor Red
                $overSize++
            }
        }
        if ($overSize -gt 0) { $failed++ } else { Write-Host 'size gate: ok' -ForegroundColor DarkGray }
    }

    if ($Staged) {
        Write-Host '--- staged files ---' -ForegroundColor Cyan
        $stagedRaw = (@(& git -c core.quotepath=false diff --cached --name-only -z 2>$null) -join '')
        $stagedFiles = @()
        if ($stagedRaw) { $stagedFiles = @($stagedRaw -split "`0" | Where-Object { $_ }) }
        $stagedBad = 0
        foreach ($p in $stagedFiles) {
            if ($p -match '^_local/' -or $p -match '\.(?:sql|docx|xlsx|zip|7z)$' -or $p -match '^\.pnpm-store/') {
                Write-Host "  staged but must not be committed: $p" -ForegroundColor Red
                $stagedBad++
            }
        }
        if ($stagedBad -gt 0) { $failed++ } else { Write-Host 'staged files: ok' -ForegroundColor DarkGray }
    }

    # Generated docs must match the source. _local/ is gitignored, so skip when absent.
    $docs = "$root\_local\tools\build-docs.js"
    if (Test-Path $docs) {
        Write-Host '--- docs freshness ---' -ForegroundColor Cyan
        & $node $docs --check
        if ($LASTEXITCODE -ne 0) { $failed++ }
    } else {
        Write-Host '--- docs freshness: build-docs.js not found, skipped ---' -ForegroundColor DarkGray
    }

    # RPG6 skill library structure: unknown op, undeclared mark, bad field, missing anchor.
    $rpg6lint = "$root\_local\tools\rpg6-lint.js"
    if (Test-Path $rpg6lint) {
        Write-Host '--- rpg6 skill lint ---' -ForegroundColor Cyan
        & $node $rpg6lint
        if ($LASTEXITCODE -ne 0) { $failed++ }
    } else {
        Write-Host '--- rpg6 skill lint: _local/tools/rpg6-lint.js not found, skipped ---' -ForegroundColor DarkGray
    }

    # Character / skill / op / version numbers written into docs must match the data.
    $rpg6stats = "$root\_local\tools\rpg6-stats.js"
    if (Test-Path $rpg6stats) {
        Write-Host '--- rpg6 doc numbers ---' -ForegroundColor Cyan
        & $node $rpg6stats --check
        if ($LASTEXITCODE -ne 0) { $failed++ }
    } else {
        Write-Host '--- rpg6 doc numbers: _local/tools/rpg6-stats.js not found, skipped ---' -ForegroundColor DarkGray
    }

    # Engine rule files changed but ENGINE_VERSION did not: old battle records would replay wrong.
    if ($Staged) {
        Write-Host '--- engine version guard ---' -ForegroundColor Cyan
        if ($env:DSH_SKIP_ENGINE_VERSION_GUARD -eq '1') {
            Write-Host 'BYPASSED by DSH_SKIP_ENGINE_VERSION_GUARD=1: staged engine files need no version bump. Say why in the commit message.' -ForegroundColor Yellow
        } else {
            $guardFailed = Test-EngineVersionGuard
            if ($guardFailed) { $failed++ }
        }
    }

    $biome = Find-Tool 'biome'
    if ($biome -and (Test-Path "$root\biome.json")) {
        Write-Host '--- biome ---' -ForegroundColor Cyan
        # summary：逐条诊断有两千多行输出，闸只要「哪个文件几条」；看细节直接跑 biome。
        & $biome check --reporter=summary
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

# PreToolUse(RunCommand) hook for TRAE SOLO. Denies commands that destroy uncommitted work.
# Reads hook JSON on stdin, writes a permission decision on stdout.
# ASCII only: Windows PowerShell 5.1 reads UTF-8 without BOM as ANSI.
$ErrorActionPreference = "Continue"

$raw = ""
try { $raw = [Console]::In.ReadToEnd() } catch { }
if (-not $raw) { exit 0 }

$cmd = ""
try { $cmd = [string](($raw | ConvertFrom-Json).tool_input.command) } catch { exit 0 }
if (-not $cmd) { exit 0 }

$rules = @(
  @{ pattern = 'git\s+clean';              reason = 'git clean deletes untracked files: new .trae/ files, and _local/ when -x is used. Ask the user before cleaning.' },
  @{ pattern = 'git\s+reset\s+--hard';     reason = 'git reset --hard discards uncommitted work in every module. Use "git checkout HEAD -- <path>" on one file instead.' },
  @{ pattern = 'git\s+push\s+.*(--force|-f)\b'; reason = 'Force push rewrites published history. Ask the user.' },
  @{ pattern = '(Remove-Item|rm|del)\b[^\r\n]*-Recurse[^\r\n]*D:\\CPU'; reason = 'Recursive delete under D:\CPU. Do it by explicit path, one file at a time.' },
  @{ pattern = 'rmdir\s+/s\s+/q\s+D:\\CPU'; reason = 'Recursive delete under D:\CPU. Do it by explicit path.' }
)

foreach ($rule in $rules) {
  if ($cmd -match $rule.pattern) {
    $out = @{
      hookSpecificOutput = @{
        hookEventName = "PreToolUse"
        permissionDecision = "deny"
        permissionDecisionReason = $rule.reason
      }
    }
    $out | ConvertTo-Json -Compress -Depth 5
    exit 0
  }
}

exit 0

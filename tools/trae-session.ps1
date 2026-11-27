# SessionStart hook for TRAE SOLO. Reports workspace state to the model as plain text.
# ASCII only: Windows PowerShell 5.1 reads UTF-8 without BOM as ANSI.
$ErrorActionPreference = "Continue"

$branch = ""
$last = ""
$dirty = @()
try { $branch = (& git rev-parse --abbrev-ref HEAD 2>$null) } catch { }
try { $last = (& git log -1 --oneline 2>$null) } catch { }
try { $dirty = @(& git status --short 2>$null) } catch { }

Write-Output "Workspace: CPU site (static HTML/CSS/JS, no build step)."
Write-Output "Rules: AGENTS.md (project rules). Protocol: .trae/team-plan.md (3 roles, 2 active lines)."
if ($branch) { Write-Output ("Branch: " + $branch) }
if ($last) { Write-Output ("Last commit: " + $last) }
Write-Output ("Uncommitted entries: " + @($dirty).Count)
@($dirty) | Select-Object -First 10 | ForEach-Object { Write-Output ("  " + $_) }
Write-Output "Active line A (battle): rpg6.0/test.html, css/battle.css, js/battle/, data/rule-docs.js, engine rules.js/timeline.js"
Write-Output "Active line B (characters): rpg6.0/data/skills/, js/engine/ops/, js/rpg-data.js, js/rpg-form.js"
Write-Output "Shared (one line at a time): js/engine/version.js, data/config.js, tests/engine/, tools/size-budget.json"
Write-Output "Before writing code: name the spec dir and task card. Do not commit with publish.ps1 while the other line has uncommitted work."

exit 0

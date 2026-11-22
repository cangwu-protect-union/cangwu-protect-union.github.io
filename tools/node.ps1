# tools/node.ps1 -- one node lookup for every script.
# ASCII only: Windows PowerShell 5.1 reads UTF-8 without BOM as ANSI.
# Usage: . "$root\tools\node.ps1"; $node = Get-NodeExe
function Get-NodeExe {
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidates = @()
    $candidates += Get-ChildItem "$env:USERPROFILE\.dsh\dsh-runtimes\*\dependencies\node\bin\node.exe" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -ExpandProperty FullName
    $candidates += 'C:\Program Files\nodejs\node.exe'
    foreach ($c in $candidates) { if ($c -and (Test-Path $c)) { return $c } }
    return $null
}

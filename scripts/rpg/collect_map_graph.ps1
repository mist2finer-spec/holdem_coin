param(
    [string]$Root = "$env:USERPROFILE\VardianRE",
    [string]$Bundle = "",
    [string]$Python = "python"
)
$ErrorActionPreference = 'Stop'
$collector = Join-Path $PSScriptRoot 'collect_map_graph.py'
if (-not (Test-Path -LiteralPath $collector)) { throw "Missing collector: $collector" }
if ([string]::IsNullOrWhiteSpace($Bundle)) {
    $found = @(Get-ChildItem -LiteralPath $Root -Recurse -File -Filter 'map_scenes*.bundle' -ErrorAction SilentlyContinue)
    if ($found.Count -ne 1) {
        $found | Select-Object FullName, Length | Format-Table -AutoSize
        throw 'Specify -Bundle with one original map_scenes bundle. Legacy exported JSON cannot recover overwritten scene identities.'
    }
    $Bundle = $found[0].FullName
}
if (-not (Test-Path -LiteralPath $Bundle)) { throw "Bundle not found: $Bundle" }
& $Python -c 'import UnityPy'
if ($LASTEXITCODE -ne 0) { throw 'Install dependency first: python -m pip install UnityPy' }
$out = Join-Path ([Environment]::GetFolderPath('Desktop')) ('vardian-map-graph-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
& $Python $collector --bundle $Bundle --output $out
if ($LASTEXITCODE -ne 0) { throw 'Map graph collection failed; read the error above.' }
Compress-Archive -LiteralPath $out -DestinationPath ($out + '.zip')
Write-Host ('Ready: ' + $out + '.zip')

param(
    [string]$Root = "$env:USERPROFILE\VardianRE",
    [string]$Bundle = "",
    [string]$Apk = "",
    [string]$Python = "python"
)
$ErrorActionPreference = 'Stop'
$collector = Join-Path $PSScriptRoot 'collect_map_graph.py'
if (-not (Test-Path -LiteralPath $collector)) { throw "Missing collector: $collector" }
if ($Bundle -and $Apk) { throw 'Specify either -Bundle or -Apk.' }
if (-not $Bundle -and -not $Apk) {
    $bundles = @(Get-ChildItem -LiteralPath $Root -Recurse -File -Filter 'map_scenes*.bundle' -ErrorAction SilentlyContinue)
    if ($bundles.Count -eq 1) { $Bundle = $bundles[0].FullName }
    elseif ($bundles.Count -gt 1) {
        $bundles | Select-Object FullName, Length | Format-Table -AutoSize
        throw 'Several versions found. Specify one original map bundle with -Bundle.'
    } else {
        $apks = @(Get-ChildItem -LiteralPath $Root -Recurse -File -Filter 'split_UnityDataAssetPack.apk' -ErrorAction SilentlyContinue)
        if ($apks.Count -gt 1) {
            $expected = 'FB4D33BC24ECEF42C42DA8D412374335BB9F2A968C2C5318991B9DE8F43BF861'
            $matched = @($apks | Where-Object { (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash -eq $expected })
            if ($matched.Count -ge 1) { $Apk = $matched[0].FullName }
        } elseif ($apks.Count -eq 1) { $Apk = $apks[0].FullName }
        if (-not $Apk) {
            $apks | Select-Object FullName, Length | Format-Table -AutoSize
            throw 'Original bundle/split APK not uniquely found. Specify -Apk or -Bundle; exported JSON cannot replace original scene files.'
        }
    }
}
$inputFile = if ($Bundle) { $Bundle } else { $Apk }
if (-not (Test-Path -LiteralPath $inputFile)) { throw "Source not found: $inputFile" }
& $Python -c 'import sys; assert sys.version_info >= (3, 11), "Python 3.11+ required"'
if ($LASTEXITCODE -ne 0) { throw 'Install Python 3.11+ before running this collector.' }
& $Python -c 'import UnityPy'
if ($LASTEXITCODE -ne 0) {
    & $Python -m pip install UnityPy
    if ($LASTEXITCODE -ne 0) { throw 'UnityPy installation failed. Python 3.11+ is required.' }
}
$out = Join-Path ([Environment]::GetFolderPath('Desktop')) ('vardian-map-graph-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
Write-Host ('Reading original: ' + $inputFile)
if ($Bundle) { & $Python $collector --bundle $Bundle --output $out }
else { & $Python $collector --apk $Apk --output $out }
if ($LASTEXITCODE -ne 0) { throw 'Map graph collection failed; read the error above.' }
Compress-Archive -LiteralPath $out -DestinationPath ($out + '.zip')
Write-Host ('Ready: ' + $out + '.zip')

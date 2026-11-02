param(
    [Parameter(Mandatory=$true)][string]$ProjectPath,
    [string]$SourceRepo = (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent)
)
$ErrorActionPreference = 'Stop'
$project = (Resolve-Path -LiteralPath $ProjectPath).Path
$source = (Resolve-Path -LiteralPath $SourceRepo).Path
$payload = Join-Path $source 'unity/IslandGame/Assets/Island'
if (-not (Test-Path -LiteralPath (Join-Path $project 'Packages/manifest.json'))) {
    throw 'ProjectPath must be the existing Unity project root with Assets and Packages.'
}
if (-not (Test-Path -LiteralPath (Join-Path $payload 'Resources/BossTrials/map-contract.json'))) {
    throw 'Prepared boss map missing. Run scripts/unity/prepare.ps1 in the source checkout first.'
}
if ([IO.Path]::GetFullPath((Join-Path $project 'Assets/Island')) -eq [IO.Path]::GetFullPath($payload)) {
    throw 'Source and target are the same project; use the source directly instead of installing into itself.'
}
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$staging = Join-Path $project ('.island-incoming/boss-trials-' + $stamp)
New-Item -ItemType Directory -Path $staging -Force | Out-Null
# Merge one required built-in module; keep all other package pins and local Spine paths.
$manifestPath = Join-Path $project 'Packages/manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($null -eq $manifest.dependencies) { throw 'Existing manifest has no dependencies object.' }
if ($null -eq $manifest.dependencies.PSObject.Properties['com.unity.modules.physics']) {
    $savedManifest = Join-Path $project ('.island-backups/boss-trials-' + $stamp + '/manifest.json')
    New-Item -ItemType Directory -Path (Split-Path $savedManifest -Parent) -Force | Out-Null
    Copy-Item -LiteralPath $manifestPath -Destination $savedManifest
    $manifest.dependencies | Add-Member -MemberType NoteProperty -Name 'com.unity.modules.physics' -Value '1.0.0'
    $json = $manifest | ConvertTo-Json -Depth 100
    try {
        [IO.File]::WriteAllText($manifestPath, $json, (New-Object Text.UTF8Encoding($false)))
        $verify = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
        if ($verify.dependencies.'com.unity.modules.physics' -ne '1.0.0') { throw 'Physics module verification failed.' }
    } catch {
        Copy-Item -LiteralPath $savedManifest -Destination $manifestPath -Force
        throw
    }
    Write-Host ('Added built-in physics module. Previous manifest: ' + $savedManifest)
}
$plan = New-Object System.Collections.Generic.List[object]
# Add only this feature. Existing client files are merge candidates, never blind replacements.
$files = @(Get-ChildItem -LiteralPath (Join-Path $payload 'Runtime') -Recurse -File |
    Where-Object { $_.Name -like 'BossTrial*.cs' -or $_.Name -eq 'UnityDisplayNames.cs' })
$files += @(Get-ChildItem -LiteralPath (Join-Path $payload 'Editor') -File |
    Where-Object { $_.Name -like 'BossTrial*.cs' })
foreach ($sub in @('Resources/BossTrials', 'Resources/WebAssets/rpg/maps/candle-dungeon',
    'Resources/WebAssets/rpg/monsters','Resources/WebAssets/rpg/characters/hong')) {
    $folder = Join-Path $payload $sub
    if (Test-Path -LiteralPath $folder) { $files += @(Get-ChildItem -LiteralPath $folder -File -Recurse) }
}
foreach ($sub in @('Resources/UnityDisplayNames.json','Resources/RpgCatalog.json',
    'Resources/AssetIndex.json','Resources/asset-export.json',
    'Runtime/IslandApp.cs','Runtime/IslandRpgPresentation.cs','Runtime/NativeBattle.cs')) {
    $file = Join-Path $payload $sub
    if (Test-Path -LiteralPath $file) { $files += @(Get-Item -LiteralPath $file) }
}
foreach ($file in ($files | Sort-Object FullName -Unique)) {
    $relative = $file.FullName.Substring($payload.Length).TrimStart([char[]]@(92,47))
    $destination = Join-Path (Join-Path $project 'Assets/Island') $relative
    $manual = $relative -in @('Runtime\IslandApp.cs','Runtime\IslandRpgPresentation.cs',
        'Runtime/IslandApp.cs','Runtime/IslandRpgPresentation.cs','Runtime/NativeBattle.cs',
        'Runtime\NativeBattle.cs')
    $status = 'added'
    if (Test-Path -LiteralPath $destination) {
        $same = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash -eq
                (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
        if ($same) { $status = 'unchanged' }
        else { $status = 'staged-conflict' }
    }
    if ($manual -and $status -ne 'unchanged') { $status = 'manual-merge' }
    if ($status -eq 'added') {
        New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
        Copy-Item -LiteralPath $file.FullName -Destination $destination
    } elseif ($status -ne 'unchanged') {
        $incoming = Join-Path $staging ('Assets/Island/' + $relative)
        New-Item -ItemType Directory -Path (Split-Path $incoming -Parent) -Force | Out-Null
        Copy-Item -LiteralPath $file.FullName -Destination $incoming
    }
    $plan.Add([PSCustomObject]@{ path=$relative; status=$status })
}
$report = Join-Path $staging 'install-report.json'
ConvertTo-Json -InputObject @($plan.ToArray()) -Depth 4 | Set-Content -LiteralPath $report -Encoding UTF8
$pending = @($plan | Where-Object { $_.status -in @('staged-conflict','manual-merge') })
$plan | Format-Table -AutoSize
Write-Host ('Install report: ' + $report)
Write-Host ('Existing files were preserved. Pending merges: ' + $pending.Count)
Write-Host 'Use the Unity-connected agent to merge staged files and validate Editor compilation and Play Mode.'
Write-Host 'Only the required built-in physics manifest entry is added if absent; existing package pins are preserved. No web/server code is changed and Editor compilation is not claimed.'

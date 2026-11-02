param([Parameter(Mandatory=$true)][string]$ProjectPath,[string]$SpineSourceRoot='')
$ErrorActionPreference='Stop'
# In the prepared delivery this script sits beside IslandGame; in a checkout it is under scripts/unity.
$payload=Join-Path $PSScriptRoot 'IslandGame'
if (-not (Test-Path (Join-Path $payload 'Assets/Island/Runtime/IslandApp.cs'))) {
    $payload=Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'unity/IslandGame'
}
$target=(Resolve-Path -LiteralPath $ProjectPath).Path
if (-not (Test-Path (Join-Path $target 'Assets')) -or -not (Test-Path (Join-Path $target 'Packages/manifest.json'))) {
    throw 'Choose the actual Unity project root containing Assets and Packages (not My project (1) or Assets itself).'
}
if (-not (Test-Path (Join-Path $payload 'Assets/Island/Resources/RpgCatalog.json'))) {throw 'Prepared assets missing. Run scripts/unity/prepare.ps1 from a full source checkout first.'}
if (Test-Path (Join-Path $target 'Temp/UnityLockfile')) {throw 'Close Unity Editor before updating this project.'}
$backup=Join-Path $target ('IslandUpdateBackups/'+(Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
$sourceAssets=Join-Path $payload 'Assets/Island'
foreach ($file in Get-ChildItem -LiteralPath $sourceAssets -File -Recurse) {
    $relative=$file.FullName.Substring($sourceAssets.Length).TrimStart([char[]]@('\','/'))
    $destination=Join-Path (Join-Path $target 'Assets/Island') $relative
    if ($file.Extension -eq ".meta" -and (Test-Path -LiteralPath $destination)) { continue }
    if (Test-Path -LiteralPath $destination) {
        $saved=Join-Path $backup ('Assets/Island/'+$relative)
        New-Item -ItemType Directory -Force -Path (Split-Path $saved -Parent)|Out-Null
        Copy-Item -LiteralPath $destination -Destination $saved -Force
    }
    New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent)|Out-Null
    Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
}
$repair=Join-Path $PSScriptRoot 'repair_project.ps1'
$arguments=@{ProjectPath=$target};if ($SpineSourceRoot) {$arguments.SpineSourceRoot=$SpineSourceRoot}
& $repair @arguments
if (-not $?) {throw 'Dependency repair failed; source backup is under IslandUpdateBackups.'}
Write-Host ('Updated: '+$target)
Write-Host ('Previous changed files: '+$backup)
Write-Host 'Open this exact project in Unity Hub, then Island > Create integration scene and Play.'

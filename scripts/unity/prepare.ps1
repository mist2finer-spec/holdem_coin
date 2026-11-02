#Requires -Version 5.1
<#
.SYNOPSIS
Prepare this checkout's Unity client, or update an existing Unity project in place.
.EXAMPLE
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\unity\prepare.ps1 -ProjectPath 'G:\Unity\IslandGame'
.NOTES
Close Unity first. The destination must be an existing Unity project root.
Runtime and Editor files that are overwritten are backed up. Other project
settings, scenes, assets and existing .meta identities are preserved.
#>
[CmdletBinding()]
param(
    [string]$ProjectPath,
    [Alias('SourceRoot')][string]$SpineSourceRoot,
    [string]$CachePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$sourceProject = Join-Path $repo 'unity/IslandGame'
if ([string]::IsNullOrWhiteSpace($ProjectPath)) { $ProjectPath = $sourceProject }
$ProjectPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($ProjectPath)
$exporter = Join-Path $PSScriptRoot 'prepare_assets.py'
foreach ($required in @($exporter, (Join-Path $sourceProject 'Assets/Island/Runtime'), (Join-Path $sourceProject 'Assets/Island/Editor'))) {
    if (-not (Test-Path -LiteralPath $required)) {
        throw "The complete source checkout is required for prepare.ps1: missing '$required'. For dependency repair alone, run repair_project.ps1 -ProjectPath '$ProjectPath'."
    }
}

$python = Get-Command python -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if ($null -eq $python) { $python = Get-Command python3 -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1 }
if ($null -eq $python) { throw 'Install Python 3 and add it to PATH, then rerun prepare.ps1.' }
& $python.Source -c "import sys; assert sys.version_info >= (3, 9), 'Python 3.9 or newer is required'"
if ($LASTEXITCODE -ne 0) { throw 'Python 3.9 or newer could not run. Check the Python installation and PATH.' }
& $python.Source -c "import importlib.util, sys; sys.exit(0 if importlib.util.find_spec('PIL') else 1)"
if ($LASTEXITCODE -ne 0) {
    & $python.Source -m pip install Pillow
    if ($LASTEXITCODE -ne 0) { throw 'Pillow installation failed. Install Pillow for this Python interpreter, then rerun.' }
}

$repairArguments = @{ ProjectPath = $ProjectPath }
if ($SpineSourceRoot) { $repairArguments['SpineSourceRoot'] = $SpineSourceRoot }
if ($CachePath) { $repairArguments['CachePath'] = $CachePath }
& (Join-Path $PSScriptRoot 'repair_project.ps1') @repairArguments

$backup = Join-Path $ProjectPath ('.island-backups/client-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [System.Guid]::NewGuid().ToString('N').Substring(0, 8))
$copied = 0
$sourceProject = [System.IO.Path]::GetFullPath($sourceProject)
$pathSeparators = [char[]]@([char]92, [char]47)
if (-not $ProjectPath.TrimEnd($pathSeparators).Equals($sourceProject.TrimEnd($pathSeparators), [System.StringComparison]::OrdinalIgnoreCase)) {
    foreach ($relativeRoot in @('Assets/Island/Runtime', 'Assets/Island/Editor')) {
        $sourceRoot = Join-Path $sourceProject $relativeRoot
        foreach ($file in Get-ChildItem -LiteralPath $sourceRoot -Recurse -File -Force) {
            $relative = $file.FullName.Substring($sourceProject.Length).TrimStart($pathSeparators)
            $destination = Join-Path $ProjectPath $relative
            if ((Test-Path -LiteralPath $destination) -and $file.Extension -eq '.meta') { continue }
            if (Test-Path -LiteralPath $destination) {
                $original = Join-Path $backup $relative
                [void][System.IO.Directory]::CreateDirectory((Split-Path $original -Parent))
                Copy-Item -LiteralPath $destination -Destination $original
            }
            [void][System.IO.Directory]::CreateDirectory((Split-Path $destination -Parent))
            Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
            $copied++
        }
    }
    Write-Host "Updated $copied client source files in '$ProjectPath'."
    if (Test-Path -LiteralPath $backup) { Write-Host "Client source backups: $backup" }
}

& $python.Source $exporter --project-path $ProjectPath
if ($LASTEXITCODE -ne 0) { throw 'Asset export failed. Read the error above; preparation is incomplete.' }
Write-Host "UNITY_FILES_PREPARED: $ProjectPath"
Write-Host 'Open that exact folder in Unity Hub, wait for package resolution and compilation, then use Island > Create integration scene > Play.'
Write-Host 'File preparation is complete; the Unity Editor compile and Play Mode check still need to run.'

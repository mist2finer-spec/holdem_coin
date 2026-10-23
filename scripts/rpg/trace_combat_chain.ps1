# One command: read BlueStacks Data -> trace local schemas -> package report.
# Requires Python 3.9+. Does not update/install/start the Android app.
[CmdletBinding()]
param(
    [string]$Root = 'C:\Users\SHK\VardianRE\reports',
    [string]$Adb = 'C:\Program Files\BlueStacks_nxt\HD-Adb.exe',
    [string]$Device = 'emulator-5554',
    [string]$Balance = '',
    [string]$Guid = '',
    [string]$AssetMap = '',
    [string]$Output = (Join-Path ([Environment]::GetFolderPath('Desktop')) ('vardian-combat-chain-' + (Get-Date -Format 'yyyyMMdd-HHmmss')))
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Root -PathType Container)) { throw "Missing reports directory: $Root" }
$tracer = Join-Path $PSScriptRoot 'trace_combat_chain.py'
if (-not (Test-Path -LiteralPath $tracer)) { throw 'Keep trace_combat_chain.py next to this .ps1 file.' }
$python = Get-Command python -ErrorAction SilentlyContinue
$prefix = @()
if (-not $python) {
    $python = Get-Command py -ErrorAction SilentlyContinue
    $prefix = @('-3')
}
if (-not $python) { throw 'Python 3.9+ is required. Install Python and run again.' }
& $python.Source @prefix -c 'import sys; assert sys.version_info >= (3,9), "Python 3.9+ required"'
if ($LASTEXITCODE -ne 0) { throw 'Python check failed.' }
if (Test-Path -LiteralPath $Output) { throw "Output already exists: $Output" }
New-Item -ItemType Directory -Path $Output | Out-Null
if (-not $Balance) {
    if (-not (Test-Path -LiteralPath $Adb)) { throw "ADB missing: $Adb" }
    & $Adb -s $Device get-state
    if ($LASTEXITCODE -ne 0) { throw 'ADB device unavailable. Check BlueStacks ADB setting.' }
    $Balance = Join-Path $Output 'Data'
    New-Item -ItemType Directory -Path $Balance | Out-Null
    $remote = '/sdcard/Android/data/com.redveilone.vardian/files/Data'
    foreach ($name in @('ActorData.bytes', 'ActionData.bytes', 'CombatData.bytes', 'SkillData.bytes', 'MasteryData.bytes')) {
        & $Adb -s $Device pull "$remote/$name" (Join-Path $Balance $name)
        if ($LASTEXITCODE -ne 0) { throw "Failed to pull $name; no app data was changed." }
    }
    & $Adb -s $Device shell dumpsys package com.redveilone.vardian |
        Select-String 'versionCode=|versionName=|lastUpdateTime=' |
        Out-String | Set-Content -LiteralPath (Join-Path $Output 'installed-version.txt') -Encoding UTF8
}
$traceArgs = @($tracer, '--balance', $Balance, '--root', $Root, '--output', (Join-Path $Output 'trace'))
if ($Guid) { $traceArgs += @('--guid', $Guid) }
if ($AssetMap) { $traceArgs += @('--asset-map', $AssetMap) }
& $python.Source @prefix @traceArgs
if ($LASTEXITCODE -ne 0) { throw 'Trace failed. See the error above.' }
$zip = "$Output.zip"
if (Test-Path -LiteralPath $zip) { throw "Archive already exists: $zip" }
Compress-Archive -LiteralPath $Output -DestinationPath $zip
Write-Host "Report ready: $zip"
Write-Host 'Read trace/NEEDED.txt for unresolved schemas and references. Partial does not mean complete combat restoration.'

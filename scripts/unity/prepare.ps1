$ErrorActionPreference = 'Stop'
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $repo
python -m pip install Pillow
if ($LASTEXITCODE -ne 0) { throw 'Pillow installation failed' }
python scripts/unity/prepare_assets.py
if ($LASTEXITCODE -ne 0) { throw 'Asset export failed' }
Write-Host 'Open unity/IslandGame in Unity Hub. Then Island > Create integration scene > Play.'

param([string]$Base='G:\AI\ComfyUI_windows_portable',[int]$Seed=42,[double]$Denoise=0.4)
$ErrorActionPreference='Stop'
$python=Join-Path $Base 'python_embeded\python.exe'
if (!(Test-Path -LiteralPath $python)) { throw "Python missing: $python" }
& $python (Join-Path $PSScriptRoot 'generate_combat_base.py') --base $Base --seed $Seed --denoise $Denoise.ToString([System.Globalization.CultureInfo]::InvariantCulture) --download-vae
if ($LASTEXITCODE -ne 0) { throw 'Read ERROR above.' }

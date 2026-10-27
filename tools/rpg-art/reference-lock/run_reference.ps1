param(
 [string]$Base = 'G:\AI\ComfyUI_windows_portable',
 [string]$Reference = '',
 [string]$PromptFile = '',
 [double]$Denoise = 0.20,
 [int]$Seed = 42,
 [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
$python = Join-Path $Base 'python_embeded\python.exe'
$script = Join-Path $PSScriptRoot 'generate_reference.py'
if (!(Test-Path -LiteralPath $python)) { throw "Python not found: $python" }
$argsList = @($script,'--base',$Base,'--seed',"$Seed",'--denoise',$Denoise.ToString([System.Globalization.CultureInfo]::InvariantCulture),'--download-vae')
if ($Reference) { $argsList += @('--reference',$Reference) }
if ($PromptFile) { $argsList += @('--prompt-file',$PromptFile) }
if ($CheckOnly) { $argsList += '--check-only' }
& $python @argsList
if ($LASTEXITCODE -ne 0) { throw 'Failed. Read the ERROR message above.' }

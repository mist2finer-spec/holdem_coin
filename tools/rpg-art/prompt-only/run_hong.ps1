param(
 [string]$Base = 'G:\AI\ComfyUI_windows_portable',
 [string]$Prompt = '',
 [string]$PromptFile = '',
 [int]$Seed = 42,
 [int]$Width = 512,
 [int]$Height = 768,
 [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
$python = Join-Path $Base 'python_embeded\python.exe'
$generator = Join-Path $PSScriptRoot 'generate_hong.py'
if (!(Test-Path -LiteralPath $python)) { throw "Python not found: $python" }
$argsList = @($generator, '--base', $Base, '--seed', "$Seed", '--width', "$Width", '--height', "$Height", '--download-vae')
if ($Prompt) { $argsList += @('--prompt', $Prompt) }
if ($PromptFile) { $argsList += @('--prompt-file', $PromptFile) }
if ($CheckOnly) { $argsList += '--check-only' }
& $python @argsList
if ($LASTEXITCODE -ne 0) { throw 'Generation failed. Read the ERROR message above.' }

param(
 [ValidateSet('Check','Generate','Report')][string]$Action='Check',
 [string]$Base='G:\AI\ComfyUI_windows_portable',
 [string]$Destination='G:\AI\hong-unity-spine-resume',
 [string]$Work='', [string]$Server='http://127.0.0.1:8188',
 [int]$Seed=42, [double]$Denoise=0.35
)
$ErrorActionPreference='Stop'
$python=Join-Path $Base 'python_embeded\python.exe'
if (!(Test-Path -LiteralPath $python)) { throw "Portable Python missing: $python. Use -Base to select the existing ComfyUI folder." }
$source='https://raw.githubusercontent.com/mist2finer-spec/holdem_coin/rpg/comfy-spine-resume/tools/rpg-art'
$manifest=ConvertFrom-Json @'
{
  "resume/resume_hong.py": "3e172960309439310ca9e818712294e7a3792dfe4b198f1ef69b29188988c6a9",
  "combat-base/generate_combat_base.py": "7de209ecb92e401afaccf7151fe247d47dcae8ab9c0ede019f05007e259743a0",
  "combat-base/comfy_client.py": "2a6f92b9acc986891279c8859391075a655fa2ba44e8606e30c8a857f7fd9eee",
  "combat-base/hong_combat_reference.png": "581a371b0e09c8a10b2bf9b46cd9131a58fec8b67cf38913ccc63faa051662c1"
}
'@
foreach ($entry in $manifest.PSObject.Properties) {
 $path=Join-Path $Destination $entry.Name
 if ((Test-Path -LiteralPath $path) -and (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -eq $entry.Value) { continue }
 New-Item -ItemType Directory -Path (Split-Path $path) -Force | Out-Null
 $temp=$path+'.download'
 Invoke-WebRequest -Uri "$source/$($entry.Name)" -OutFile $temp -UseBasicParsing
 if ((Get-FileHash -LiteralPath $temp -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.Value) { throw "Download hash mismatch: $($entry.Name). Download the current resume_hong.ps1 again." }
 Move-Item -LiteralPath $temp -Destination $path -Force
}
$argsList=@((Join-Path $Destination 'resume\resume_hong.py'),$Action.ToLowerInvariant(),'--base',$Base,'--server',$Server,'--seed',"$Seed",'--denoise',$Denoise.ToString([System.Globalization.CultureInfo]::InvariantCulture))
if ($Work) { $argsList+=@('--work',$Work) }
& $python @argsList
if ($LASTEXITCODE -ne 0) {
 if ($Action -ne 'Report') {
  Write-Host 'If ComfyUI is closed, run in a separate PowerShell window:'
  Write-Host ('Set-Location "'+$Base+'"')
  Write-Host '.\python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build --disable-cuda-malloc --lowvram --preview-method none'
 }
 throw 'Resume stopped. Read ERROR above; original work and existing jobs were preserved.'
}

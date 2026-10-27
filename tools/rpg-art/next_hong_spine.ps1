param(
 [ValidateSet('Prepare','Repair','Apply','Export','Report')][string]$Stage='Prepare',
 [string]$Base='G:\AI\ComfyUI_windows_portable',
 [string]$Destination='G:\AI\hong-unity-spine-resume',
 [string]$Out='G:\AI\hong_combat_spine_work',
 [string]$Part='back-upper-arm', [string]$Candidate='',
 [string]$Config='', [string]$AlphaMask='',
 [string]$Server='http://127.0.0.1:8188', [int]$Seed=42, [double]$Denoise=0.55
)
$ErrorActionPreference='Stop'
$python=Join-Path $Base 'python_embeded\python.exe'
if (!(Test-Path -LiteralPath $python)) { throw "Portable Python missing: $python" }
$source='https://raw.githubusercontent.com/mist2finer-spec/holdem_coin/rpg/comfy-spine-resume/tools/rpg-art'
$manifest=ConvertFrom-Json @'
{
  "combat-spine/build_combat_spine.py": "c7d5e881aab85ca5dfd967efbc3532c052f6567c4c38d85ce7b7001d166b281f",
  "combat-spine/hong_combat_parts.json": "d8b5b3ac63d553949b52deea66c991cdccbee04f8bd724d4bbd31d51e8ea38dd",
  "combat-spine/matte_editor.html": "85e0135592e9352422dad41e26ffc7d494b277ba8b410e041ce3162f436421e2",
  "combat-base/review/hong-generated-review.png": "233a3520b0f91eb95b8f742ddb5d640dcb0e95e0acc0003b99ff9f05eea3a540",
  "spine-draft/spine_builder.py": "ea8190be327e4864d0cf2ccdaa56313d36a2a4edbdb5f7f1e2e467c1583a361e",
  "spine-draft/comfy_client.py": "2a6f92b9acc986891279c8859391075a655fa2ba44e8606e30c8a857f7fd9eee",
  "spine-draft/editor_template.html": "6a33d9baffa5cfad5c1c36757d96b49346f61717eec8e922c0c834fe6fc6e286"
}
'@
foreach ($entry in $manifest.PSObject.Properties) {
 $path=Join-Path $Destination $entry.Name
 if ((Test-Path -LiteralPath $path) -and (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -eq $entry.Value) { continue }
 New-Item -ItemType Directory -Path (Split-Path $path) -Force | Out-Null
 $temp=$path+'.download'
 Invoke-WebRequest -Uri "$source/$($entry.Name)" -OutFile $temp -UseBasicParsing
 if ((Get-FileHash -LiteralPath $temp -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.Value) { throw "File hash mismatch: $($entry.Name). Download the current next_hong_spine.ps1 again." }
 Move-Item -LiteralPath $temp -Destination $path -Force
}
& $python -c 'import PIL'
if ($LASTEXITCODE -ne 0) {
 & $python -m pip install Pillow
 if ($LASTEXITCODE -ne 0) { throw 'Pillow installation failed.' }
}
$command=if ($Stage -eq 'Apply') { 'approve' } else { $Stage.ToLowerInvariant() }
$argsList=@((Join-Path $Destination 'combat-spine\build_combat_spine.py'),$command,'--base',$Base,'--out',$Out,'--part',$Part,'--server',$Server,'--seed',"$Seed",'--denoise',$Denoise.ToString([System.Globalization.CultureInfo]::InvariantCulture))
if ($Candidate) { $argsList+=@('--candidate',$Candidate) }
if ($Config) { $argsList+=@('--config',$Config) }
if ($AlphaMask) { $argsList+=@('--alpha-mask',$AlphaMask) }
& $python @argsList
if ($LASTEXITCODE -ne 0) { throw 'Stopped. Read ERROR above. Existing work and queued jobs were preserved.' }
if ($Stage -eq 'Prepare') {
 Start-Process (Join-Path $Out 'edit_matte.html')
 Start-Process (Join-Path $Out 'edit_parts.html')
 Start-Process (Join-Path $Out 'review\setup_preview.png')
}
if ($Stage -eq 'Export') { Start-Process (Join-Path $Out 'spine') }

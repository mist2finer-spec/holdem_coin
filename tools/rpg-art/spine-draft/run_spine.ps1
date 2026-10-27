param(
 [ValidateSet('prepare','repair','approve','export')][string]$Stage='prepare',
 [string]$Base='G:\AI\ComfyUI_windows_portable',
 [string]$Out='', [string]$Config='', [string]$Part='torso',
 [string]$Candidate='', [double]$Denoise=0.65, [int]$Seed=42
)
$ErrorActionPreference='Stop'
$python=Join-Path $Base 'python_embeded\python.exe'
if (!(Test-Path -LiteralPath $python)) { throw "Python missing: $python" }
& $python -c 'import PIL' 2>$null
if ($LASTEXITCODE -ne 0) {
 & $python -m pip install Pillow
 if ($LASTEXITCODE -ne 0) { throw 'Pillow installation failed.' }
}
if (!$Out) { $Out=Join-Path $Base 'hong_spine_work' }
$argsList=@((Join-Path $PSScriptRoot 'spine_builder.py'),$Stage,'--base',$Base,'--out',$Out,'--part',$Part,'--seed',"$Seed",'--denoise',$Denoise.ToString([System.Globalization.CultureInfo]::InvariantCulture),'--download-vae')
if ($Config) { $argsList+=@('--config',$Config) }
if ($Candidate) { $argsList+=@('--candidate',$Candidate) }
& $python @argsList
if ($LASTEXITCODE -ne 0) { throw 'Failed. Read ERROR above.' }
if ($Stage -eq 'prepare') { Start-Process (Join-Path $Out 'edit_parts.html') }

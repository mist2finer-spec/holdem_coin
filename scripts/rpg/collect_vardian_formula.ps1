param(
  [string]$Root = "$env:USERPROFILE\VardianRE\reports\acheive\cpp2il_isil_v1211\IsilDump",
  [string]$OutputParent = [Environment]::GetFolderPath('Desktop')
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Root -PathType Container)) { throw "ISIL directory missing: $Root" }
$dest = Join-Path $OutputParent ('vardian-formula-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $dest | Out-Null
$pattern = 'QuadFunc|LevelUpQuadFuncDatas|ReqLevelUpMatFuncDatas|GetReqLevelUp|CalcReqLevelUp|KeyFrameData|class BigInt|struct BigInt'
$items = New-Object System.Collections.Generic.List[object]
$warnings = New-Object System.Collections.Generic.List[string]
$scanned = 0
$copiedBytes = 0L
foreach ($path in [IO.Directory]::EnumerateFiles($Root, '*', [IO.SearchOption]::AllDirectories)) {
  $ext = [IO.Path]::GetExtension($path).ToLowerInvariant()
  if ($ext -notin @('.txt', '.cs', '.fbs')) { continue }
  $scanned++
  if ($scanned -gt 50000) { $warnings.Add('Scan stopped after 50000 candidate files.'); break }
  $file = Get-Item -LiteralPath $path
  if ($file.Length -gt 16MB) { $warnings.Add("Oversized file skipped: $path"); continue }
  if (($ext -ne '.fbs') -and -not (Select-String -LiteralPath $path -Pattern $pattern -Quiet)) { continue }
  if (($copiedBytes + $file.Length) -gt 50MB) { $warnings.Add('50MB collection limit reached.'); break }
  $relative = $path.Substring($Root.TrimEnd('\').Length).TrimStart('\')
  $target = Join-Path (Join-Path $dest 'Sources') $relative
  New-Item -ItemType Directory -Path (Split-Path $target) -Force | Out-Null
  Copy-Item -LiteralPath $path -Destination $target
  $copiedBytes += $file.Length
  $items.Add([pscustomobject]@{path=$relative; bytes=$file.Length; sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash})
}
[pscustomobject]@{root=$Root; scanned=$scanned; files=@($items.ToArray()); warnings=@($warnings.ToArray())} |
  ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $dest 'collection.json') -Encoding UTF8
@'
Offline static-code collection only. No game launch, update, ADB or account access.
If no evaluator is found, obtain matching-version libil2cpp.so + global-metadata.dat
from the previously extracted APK set. Do not mix versions or overwrite old files.
Exported C# method stubs alone do not prove formulas or floating-point defaults.
'@ | Set-Content -LiteralPath (Join-Path $dest 'README.txt') -Encoding UTF8
$zip = "$dest.zip"
Compress-Archive -Path (Join-Path $dest '*') -DestinationPath $zip
Write-Host "Collected $($items.Count) files; scanned $scanned candidates."
foreach ($warning in $warnings) { Write-Warning $warning }
Write-Host "Upload: $zip"

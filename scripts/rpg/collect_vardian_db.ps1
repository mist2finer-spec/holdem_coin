param(
  [string]$ReportsRoot = (Join-Path $env:USERPROFILE 'VardianRE\reports'),
  [string]$SchemaRoot = '',
  [string]$BalanceDir = '',
  [string]$AdbPath = '',
  [string]$Device = '',
  [switch]$Offline,
  [string]$OutputRoot = ([Environment]::GetFolderPath('Desktop'))
)
$ErrorActionPreference = 'Stop'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$out = Join-Path $OutputRoot "vardian-db-$stamp"
New-Item -ItemType Directory -Path $out -Force | Out-Null
$dataOut = Join-Path $out 'Data'
$schemaOut = Join-Path $out 'Schemas'
New-Item -ItemType Directory -Path $dataOut,$schemaOut -Force | Out-Null
$warnings = New-Object 'System.Collections.Generic.List[string]'
$manifest = [ordered]@{version=1;createdAt=(Get-Date).ToUniversalTime().ToString('o');package='com.redveilone.vardian';readOnly=$true;data=@();schemas=@();warnings=@()}

function Read-TextSample([string]$Path) {
  $reader = [IO.File]::OpenText($Path)
  try {
    $lines = New-Object 'System.Collections.Generic.List[string]'
    for($i=0;$i -lt 30 -and -not $reader.EndOfStream;$i++){ $lines.Add($reader.ReadLine()) }
    return $lines -join "`n"
  } finally { $reader.Dispose() }
}

if(-not $Offline) {
  if(-not $AdbPath) {
    $candidates = @(
      'C:\Program Files\BlueStacks_nxt\HD-Adb.exe',
      'C:\Program Files\BlueStacks\HD-Adb.exe',
      (Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe')
    )
    $AdbPath = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if(-not $AdbPath){ $command=Get-Command adb -ErrorAction SilentlyContinue; if($command){$AdbPath=$command.Source} }
  }
  if(-not $AdbPath -or -not (Test-Path -LiteralPath $AdbPath)){throw 'ADB not found. Start BlueStacks, or pass -AdbPath. Local files only: use -Offline -BalanceDir PATH.'}
  & $AdbPath start-server | Out-Null
  if($LASTEXITCODE -ne 0){throw 'ADB server failed.'}
  $listing = @(& $AdbPath devices)
  $serials = @($listing | ForEach-Object {if($_ -match '^(\S+)\s+device\s*$'){$Matches[1]}})
  if(-not $Device -and $serials.Count -eq 0) {
    # BlueStacks reconnect: only ports explicitly present in its local config.
    foreach($config in @('C:\ProgramData\BlueStacks_nxt\bluestacks.conf','C:\ProgramData\BlueStacks\bluestacks.conf')) {
      if(Test-Path -LiteralPath $config) {
        foreach($line in Get-Content -LiteralPath $config) {
          if($line -match '^bst\.instance\.[^.]+\.(?:adb_port|status\.adb_port)="?(\d+)"?$') {
            $port=[int]$Matches[1]
            if($port -gt 0 -and $port -le 65535){& $AdbPath connect "127.0.0.1:$port" | Out-Null}
          }
        }
      }
    }
    $listing=@(& $AdbPath devices)
    $serials=@($listing | ForEach-Object {if($_ -match '^(\S+)\s+device\s*$'){$Matches[1]}})
  }
  if(-not $Device) {
    if($serials.Count -eq 1){$Device=$serials[0]}
    elseif($serials.Count -eq 0){throw 'No device. Enable BlueStacks Settings > Advanced > ADB, keep the instance running, and run again.'}
    else {throw ('Multiple devices: '+($serials -join ', ')+'. Run again with -Device SERIAL.')}
  }
  if($Device -match '^127\.0\.0\.1:\d+$'){& $AdbPath connect $Device | Out-Null}
  & $AdbPath -s $Device get-state
  if($LASTEXITCODE -ne 0){throw "Device unavailable: $Device"}
  $pkg='com.redveilone.vardian'
  $installed=@(& $AdbPath -s $Device shell pm path $pkg)
  if($LASTEXITCODE -ne 0 -or -not ($installed -match '^package:')){throw "Package not found: $pkg"}
  $version=@(& $AdbPath -s $Device shell dumpsys package $pkg) | Select-String 'versionCode=|versionName=' | ForEach-Object {$_.Line.Trim()}
  $version | Set-Content -LiteralPath (Join-Path $out 'installed-version.txt') -Encoding UTF8
  # Static balance files only. No app launch/update, cache, login files, database writes or root.
  $remote="/sdcard/Android/data/$pkg/files/Data"
  & $AdbPath -s $Device shell ls $remote | Set-Content -LiteralPath (Join-Path $out 'remote-data-list.txt') -Encoding UTF8
  if($LASTEXITCODE -ne 0){throw 'Static Data directory is inaccessible. No bypass is attempted.'}
  $remoteFiles=@(& $AdbPath -s $Device shell ls $remote)
  foreach($entry in $remoteFiles) {
    $name=$entry.Trim()
    if($name -match '^[A-Za-z][A-Za-z0-9_]*(?:\.pack)?\.bytes$') {
      & $AdbPath -s $Device pull "$remote/$name" (Join-Path $dataOut $name)
      if($LASTEXITCODE -ne 0){$warnings.Add("Pull failed: $name")}
    }
  }
}

if($BalanceDir) {
  if(-not (Test-Path -LiteralPath $BalanceDir -PathType Container)){throw "BalanceDir not found: $BalanceDir"}
  Get-ChildItem -LiteralPath $BalanceDir -File -Filter '*.bytes' | ForEach-Object {
    $dest=Join-Path $dataOut $_.Name
    if(Test-Path -LiteralPath $dest){
      if((Get-FileHash -LiteralPath $dest).Hash -ne (Get-FileHash -LiteralPath $_.FullName).Hash){throw "Different versions of $($_.Name). Do not mix builds."}
    } else {Copy-Item -LiteralPath $_.FullName -Destination $dest}
  }
}

$roots=@()
if($SchemaRoot){
  if(-not (Test-Path -LiteralPath $SchemaRoot -PathType Container)){throw "SchemaRoot not found: $SchemaRoot"}
  $roots=@((Get-Item -LiteralPath $SchemaRoot).FullName)
} else {
  # Deliberately scoped: never recurse through the full reports/assets tree.
  $known=Join-Path $ReportsRoot 'acheive\cpp2il_isil_v1211\IsilDump\InHouse.Balance.Runtime'
  if(Test-Path -LiteralPath $known){$roots=@($known)}
}
if(-not $roots.Count){$warnings.Add('ISIL schema directory not found. Supply -SchemaRoot with the matching InHouse.Balance.Runtime directory.')}
$count=0
foreach($root in $roots){
  Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction Stop | ForEach-Object {
    $count++
    if($count -gt 25000){throw 'Schema scan exceeds 25000 files. Pass a narrower -SchemaRoot; do not use the reports root.'}
    if(($_.Extension -in @('.txt','.cs','.fbs')) -and $_.Length -le 16777216){
      $sample=Read-TextSample $_.FullName
      if($_.Extension -eq '.fbs' -or $sample -match '(?m)^Type: BalanceData\.\w+\s*$' -or $sample -match 'namespace BalanceData') {
        $id=$manifest.schemas.Count
        $name=('{0:D5}-{1}' -f $id,$_.Name)
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $schemaOut $name)
        $manifest.schemas+=@{file="Schemas/$name";sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLower();bytes=$_.Length}
      }
    }
  }
}
foreach($f in Get-ChildItem -LiteralPath $dataOut -File -Filter '*.bytes'){
  $manifest.data+=@{file="Data/$($f.Name)";sha256=(Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash.ToLower();bytes=$f.Length}
}
if(-not $manifest.data.Count -and -not $manifest.schemas.Count){throw 'No data or schemas collected. Check paths/device; no empty report is produced.'}
$manifest.warnings=@($warnings)
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $out 'collection.json') -Encoding UTF8
@'
Static data and schema collection only. This is not a full DB restore.
Check installed-version.txt against the APK/build used to generate Schemas.
If versions differ, retain both separately and regenerate matching schemas.
No accounts, tokens, HTTP cache or player save files are included.
Send the ZIP for field/schema matching and growth/economy table recovery.
'@ | Set-Content -LiteralPath (Join-Path $out 'READ_ME.txt') -Encoding UTF8
$zip="$out.zip"
Compress-Archive -Path (Join-Path $out '*') -DestinationPath $zip -CompressionLevel Optimal
Write-Host "COLLECTED data=$($manifest.data.Count) schemas=$($manifest.schemas.Count)"
foreach($warning in $warnings){Write-Warning $warning}
Write-Host "REPORT_READY: $zip"

#Requires -Version 5.1
<#
.SYNOPSIS
Install the pinned official Spine packages without requiring Git.
.DESCRIPTION
Close the Unity Editor before running. ProjectPath must be the actual project
folder containing Assets, Packages and ProjectSettings. Existing project content
is preserved; manifests and any replaced package folders are backed up.
The default source is one cached official GitHub ZIP. For an offline installation,
extract that same ZIP and pass its spine-runtimes-<commit> folder as SpineSourceRoot.
Both complete package trees must match the pinned official Git object hashes.
.EXAMPLE
powershell -NoProfile -ExecutionPolicy Bypass -File .\repair_project.ps1 -ProjectPath 'G:\Unity\IslandGame'
.EXAMPLE
.\repair_project.ps1 -ProjectPath 'G:\Unity\IslandGame' -SpineSourceRoot 'D:\Downloads\spine-runtimes-5cb78e77d3711ddcd80c7bd043bb11cf70fcc88c'
#>
[CmdletBinding()]
param(
    [string]$ProjectPath,
    [Alias('SourceRoot')][string]$SpineSourceRoot,
    [string]$CachePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$spineCommit = '5cb78e77d3711ddcd80c7bd043bb11cf70fcc88c'
$archiveUrl = "https://github.com/EsotericSoftware/spine-runtimes/archive/$spineCommit.zip"
$packages = @(
    [pscustomobject]@{
        Name = 'com.esotericsoftware.spine.spine-csharp'
        Version = '4.2.37'
        Source = 'spine-csharp/src'
        ManifestHash = 'b058eab231fe47b4edd111116db2218fc1b77608'
        TreeHash = '81537973e77d843581d9e71668a892247c63007c'
    },
    [pscustomobject]@{
        Name = 'com.esotericsoftware.spine.spine-unity'
        Version = '4.2.121'
        Source = 'spine-unity/Assets/Spine'
        ManifestHash = '80846cc80476965fa72a2d392d0ca87169c9b666'
        TreeHash = 'b4b321f132eee9e53156a0b3a4fb2775fb1435b1'
    }
)
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Test-ProjectRoot([string]$Path) {
    return ((Test-Path -LiteralPath (Join-Path $Path 'Assets') -PathType Container) -and
        (Test-Path -LiteralPath (Join-Path $Path 'ProjectSettings') -PathType Container) -and
        (Test-Path -LiteralPath (Join-Path $Path 'Packages/manifest.json') -PathType Leaf))
}

function Assert-EditorClosed([string]$Path) {
    $lock = Join-Path $Path 'Temp/UnityLockfile'
    if (Test-Path -LiteralPath $lock) {
        try {
            $handle = [System.IO.File]::Open($lock, [System.IO.FileMode]::Open,
                [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
            $handle.Dispose()
        } catch {
            throw "Close the Unity Editor for '$Path' before repairing packages. UnityLockfile is in use."
        }
    }
}

function Read-JsonObject([string]$Path) {
    try { $value = [System.IO.File]::ReadAllText($Path) | ConvertFrom-Json }
    catch { throw "Invalid JSON in '$Path': $($_.Exception.Message)" }
    if ($null -eq $value -or $value -isnot [pscustomobject]) {
        throw "Expected a JSON object in '$Path'. No project files were changed."
    }
    return $value
}

function Get-GitObjectHash([string]$Type, [byte[]]$Bytes) {
    $hash = [System.Security.Cryptography.SHA1]::Create()
    try {
        $header = $utf8.GetBytes("$Type $($Bytes.Length)`0")
        [void]$hash.TransformBlock($header, 0, $header.Length, $header, 0)
        [void]$hash.TransformFinalBlock($Bytes, 0, $Bytes.Length)
        return ([System.BitConverter]::ToString($hash.Hash)).Replace('-', '').ToLowerInvariant()
    } finally { $hash.Dispose() }
}

function Get-GitTreeHash([string]$Path) {
    # All entries in these two pinned upstream trees are regular files (100644)
    # or directories (40000). Git sorts directory names as if suffixed with '/'.
    $entries = New-Object 'System.Collections.Generic.SortedDictionary[string,object]' ([System.StringComparer]::Ordinal)
    foreach ($entry in Get-ChildItem -LiteralPath $Path -Force) {
        if (($entry.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Links are not allowed in the pinned Spine packages: $($entry.FullName)"
        }
        if ($entry.Name -match '[^\x00-\x7f]') {
            throw "Unexpected filename in the pinned Spine packages: $($entry.FullName)"
        }
        $key = $entry.Name
        if ($entry.PSIsContainer) { $key += '/' }
        $entries.Add($key, $entry)
    }
    $buffer = New-Object System.IO.MemoryStream
    try {
        foreach ($entry in $entries.Values) {
            if ($entry.PSIsContainer) {
                $mode = '40000'
                $digest = Get-GitTreeHash $entry.FullName
            } else {
                $mode = '100644'
                $digest = Get-GitObjectHash 'blob' ([System.IO.File]::ReadAllBytes($entry.FullName))
            }
            $prefix = $utf8.GetBytes("$mode $($entry.Name)`0")
            $buffer.Write($prefix, 0, $prefix.Length)
            for ($index = 0; $index -lt 40; $index += 2) {
                $buffer.WriteByte([System.Convert]::ToByte($digest.Substring($index, 2), 16))
            }
        }
        return Get-GitObjectHash 'tree' ($buffer.ToArray())
    } finally { $buffer.Dispose() }
}

function Assert-PinnedPackage([string]$Path, $Package) {
    $packageManifest = Join-Path $Path 'package.json'
    if (-not (Test-Path -LiteralPath $packageManifest -PathType Leaf)) {
        throw "Missing $($Package.Source)/package.json. Select the extracted spine-runtimes-$spineCommit root."
    }
    $metadata = Read-JsonObject $packageManifest
    if ($metadata.name -cne $Package.Name -or $metadata.version -cne $Package.Version) {
        throw "Wrong Spine package at '$Path'. Expected $($Package.Name) $($Package.Version)."
    }
    $manifestHash = Get-GitObjectHash 'blob' ([System.IO.File]::ReadAllBytes($packageManifest))
    if ($manifestHash -ne $Package.ManifestHash -or (Get-GitTreeHash $Path) -ne $Package.TreeHash) {
        throw "Spine source does not match official commit $spineCommit at '$Path'. Use a fresh extracted ZIP; modified files, extra files, or Git CRLF conversion change the checksum."
    }
}

function Expand-PinnedPackages([string]$Archive, [string]$Destination) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($Archive)
    try {
        $root = "spine-runtimes-$spineCommit/"
        foreach ($package in $packages) {
            $prefix = "$root$($package.Source)/"
            $target = Join-Path $Destination $package.Name
            [void][System.IO.Directory]::CreateDirectory($target)
            $count = 0
            foreach ($entry in $zip.Entries) {
                if (-not $entry.FullName.StartsWith($prefix, [System.StringComparison]::Ordinal)) { continue }
                $relative = $entry.FullName.Substring($prefix.Length)
                if (-not $relative -or $relative.EndsWith('/')) { continue }
                if ($relative.Contains('\') -or $relative.Contains(':') -or
                    $relative.StartsWith('/') -or $relative -match '(^|/)\.\.?(/|$)') {
                    throw "Unsafe path in Spine archive: $($entry.FullName)"
                }
                $file = Join-Path $target $relative
                [void][System.IO.Directory]::CreateDirectory((Split-Path $file -Parent))
                # No overwrite: a malformed archive with duplicate entries must fail.
                [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $file, $false)
                $count++
            }
            if ($count -eq 0) { throw "Archive is missing '$prefix'. Expected the official pinned ZIP." }
        }
    } finally { $zip.Dispose() }
}

function Write-JsonFile([string]$Path, $Value) {
    [System.IO.File]::WriteAllText($Path, (($Value | ConvertTo-Json -Depth 100) + "`n"), $utf8)
}

if ([string]::IsNullOrWhiteSpace($ProjectPath)) {
    $repoProject = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'unity/IslandGame'
    if (Test-ProjectRoot $repoProject) { $ProjectPath = $repoProject }
    elseif (Test-ProjectRoot (Get-Location).Path) { $ProjectPath = (Get-Location).Path }
    else { throw "Specify -ProjectPath 'G:\Unity\IslandGame', pointing to the folder containing Assets, Packages and ProjectSettings." }
}
$ProjectPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($ProjectPath)
$nestedProjects = @()
if (Test-Path -LiteralPath $ProjectPath -PathType Container) {
    $nestedProjects = @(Get-ChildItem -LiteralPath $ProjectPath -Directory -Force |
        Where-Object { $_.Name -notin @('Library', 'Temp', 'Packages', 'Assets', '.git') -and (Test-ProjectRoot $_.FullName) })
}
if (-not (Test-ProjectRoot $ProjectPath)) {
    $hint = ''
    if ($nestedProjects.Count -gt 0) { $hint = " Nested project found: $($nestedProjects.FullName -join ', '). Pass that exact folder instead." }
    throw "'$ProjectPath' is not a Unity project root. It must contain Assets, Packages and ProjectSettings.$hint Do not copy a whole project into another project or into a 'My project (1)' subfolder."
}
Write-Host "Repair target: $ProjectPath"
if ($nestedProjects.Count -gt 0) {
    Write-Warning "Nested Unity project(s): $($nestedProjects.FullName -join ', '). Only '$ProjectPath' will be repaired. Open that exact root in Unity Hub; do not merge whole project folders."
}
Assert-EditorClosed $ProjectPath

$assets = Join-Path $ProjectPath 'Assets'
$duplicates = @()
if (Test-Path -LiteralPath (Join-Path $assets 'Spine')) { $duplicates += (Join-Path $assets 'Spine') }
$duplicates += @(Get-ChildItem -LiteralPath $assets -Recurse -File -Filter 'SkeletonAnimation.cs' | ForEach-Object { $_.FullName })
$duplicates += @(Get-ChildItem -LiteralPath $assets -Recurse -File -Filter 'spine-*.asmdef' |
    Where-Object { $_.Name -in @('spine-csharp.asmdef', 'spine-unity.asmdef') } | ForEach-Object { $_.FullName })
if ($duplicates.Count -gt 0) {
    throw "An existing Spine runtime is inside Assets: $($duplicates -join ', '). A second runtime would cause duplicate types. Back up and reconcile that installation before using the UPM repair. Nothing has been deleted."
}

$packageRoot = Join-Path $ProjectPath 'Packages'
$manifestPath = Join-Path $packageRoot 'manifest.json'
$lockPath = Join-Path $packageRoot 'packages-lock.json'
$manifest = Read-JsonObject $manifestPath
if (-not $manifest.PSObject.Properties['dependencies'] -or $manifest.dependencies -isnot [pscustomobject]) {
    throw "'$manifestPath' must contain a dependencies object."
}
$lock = $null
if (Test-Path -LiteralPath $lockPath) {
    $lock = Read-JsonObject $lockPath
    if (-not $lock.PSObject.Properties['dependencies'] -or $lock.dependencies -isnot [pscustomobject]) {
        throw "'$lockPath' must contain a dependencies object."
    }
}
foreach ($package in $packages) {
    $existing = Join-Path $packageRoot $package.Name
    if (Test-Path -LiteralPath $existing) {
        $existingManifest = Join-Path $existing 'package.json'
        if (-not (Test-Path -LiteralPath $existingManifest -PathType Leaf) -or
            (Read-JsonObject $existingManifest).name -cne $package.Name) {
            throw "'$existing' is not the expected package. Move or rename it explicitly before rerunning; the repair will not overwrite it."
        }
    }
}

$runId = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [System.Guid]::NewGuid().ToString('N').Substring(0, 8)
$stage = Join-Path $ProjectPath ".island-repair-stage-$runId"
$backup = Join-Path $ProjectPath ".island-backups/spine-$runId"
$installed = New-Object 'System.Collections.Generic.List[string]'
$moved = New-Object 'System.Collections.Generic.List[string]'
$manifestWritten = $false
$lockWritten = $false
try {
    [void][System.IO.Directory]::CreateDirectory($stage)
    if (-not [string]::IsNullOrWhiteSpace($SpineSourceRoot)) {
        $SpineSourceRoot = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($SpineSourceRoot)
        foreach ($package in $packages) {
            $source = Join-Path $SpineSourceRoot $package.Source
            Assert-PinnedPackage $source $package
            Copy-Item -LiteralPath $source -Destination (Join-Path $stage $package.Name) -Recurse
        }
    } else {
        if ([string]::IsNullOrWhiteSpace($CachePath)) {
            $cacheBase = [System.Environment]::GetFolderPath('LocalApplicationData')
            if (-not $cacheBase) { $cacheBase = [System.IO.Path]::GetTempPath() }
            $CachePath = Join-Path $cacheBase 'IslandGame/DependencyCache'
        }
        $CachePath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($CachePath)
        [void][System.IO.Directory]::CreateDirectory($CachePath)
        $archive = Join-Path $CachePath "spine-runtimes-$spineCommit.zip"
        if (-not (Test-Path -LiteralPath $archive -PathType Leaf)) {
            $partial = "$archive.$runId.partial"
            $tls = [System.Net.ServicePointManager]::SecurityProtocol
            $progress = $ProgressPreference
            try {
                [System.Net.ServicePointManager]::SecurityProtocol = $tls -bor [System.Net.SecurityProtocolType]::Tls12
                $ProgressPreference = 'SilentlyContinue'
                Write-Host "Downloading the official pinned Spine ZIP once: $archiveUrl"
                Invoke-WebRequest -Uri $archiveUrl -OutFile $partial -UseBasicParsing -TimeoutSec 900
                Move-Item -LiteralPath $partial -Destination $archive
            } catch {
                throw "Spine download failed: $($_.Exception.Message). Download $archiveUrl manually, extract it, and rerun with -SpineSourceRoot '<extracted root>'."
            } finally {
                [System.Net.ServicePointManager]::SecurityProtocol = $tls
                $ProgressPreference = $progress
                if (Test-Path -LiteralPath $partial) { Remove-Item -LiteralPath $partial -Force }
            }
        } else { Write-Host "Using cached Spine ZIP: $archive" }
        try { Expand-PinnedPackages $archive $stage }
        catch { throw "Cannot use cached ZIP '$archive': $($_.Exception.Message). Replace it with a fresh official ZIP or use -SpineSourceRoot." }
    }
    foreach ($package in $packages) { Assert-PinnedPackage (Join-Path $stage $package.Name) $package }
    Assert-EditorClosed $ProjectPath

    # Stage the complete new manifest before touching installed packages.
    foreach ($package in $packages) {
        $manifest.dependencies | Add-Member -MemberType NoteProperty -Name $package.Name -Value "file:$($package.Name)" -Force
        if ($null -ne $lock) { $lock.dependencies.PSObject.Properties.Remove($package.Name) }
    }
    $newManifest = Join-Path $stage 'manifest.json'
    $newLock = Join-Path $stage 'packages-lock.json'
    Write-JsonFile $newManifest $manifest
    if ($null -ne $lock) { Write-JsonFile $newLock $lock }
    [void][System.IO.Directory]::CreateDirectory($backup)
    Copy-Item -LiteralPath $manifestPath -Destination (Join-Path $backup 'manifest.json')
    if ($null -ne $lock) { Copy-Item -LiteralPath $lockPath -Destination (Join-Path $backup 'packages-lock.json') }
    Write-JsonFile (Join-Path $backup 'repair.json') ([ordered]@{
        projectPath = $ProjectPath; spineCommit = $spineCommit; archiveUrl = $archiveUrl
        packages = @($packages | Select-Object -Property @('Name', 'Version', 'TreeHash'))
    })
    Write-Host "Original files backed up to: $backup"
    foreach ($package in $packages) {
        $destination = Join-Path $packageRoot $package.Name
        if (Test-Path -LiteralPath $destination) {
            Move-Item -LiteralPath $destination -Destination (Join-Path $backup $package.Name)
            $moved.Add($package.Name)
        }
        Move-Item -LiteralPath (Join-Path $stage $package.Name) -Destination $destination
        $installed.Add($package.Name)
    }
    # PowerShell 5.1 can bind a null .NET string argument as an empty path.
    # Use portable copying: originals are already backed up above. Set the
    # rollback flag BEFORE writing so a partial copy is restored on failure.
    $manifestWritten = $true
    Copy-Item -LiteralPath $newManifest -Destination $manifestPath -Force
    if ((Get-FileHash -LiteralPath $newManifest -Algorithm SHA256).Hash -ne
        (Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash) {
        throw 'Installed manifest does not match its staged file.'
    }
    [void](Read-JsonObject $manifestPath)
    if ($null -ne $lock) {
        $lockWritten = $true
        Copy-Item -LiteralPath $newLock -Destination $lockPath -Force
        if ((Get-FileHash -LiteralPath $newLock -Algorithm SHA256).Hash -ne
            (Get-FileHash -LiteralPath $lockPath -Algorithm SHA256).Hash) {
            throw 'Installed package lock does not match its staged file.'
        }
        [void](Read-JsonObject $lockPath)
    }
} catch {
    $failure = $_
    # Roll back only paths changed by this invocation, using retained originals.
    try {
        if ($manifestWritten) { Copy-Item -LiteralPath (Join-Path $backup 'manifest.json') -Destination $manifestPath -Force }
        if ($lockWritten) { Copy-Item -LiteralPath (Join-Path $backup 'packages-lock.json') -Destination $lockPath -Force }
        foreach ($name in $installed) { Remove-Item -LiteralPath (Join-Path $packageRoot $name) -Recurse -Force }
        foreach ($name in $moved) { Move-Item -LiteralPath (Join-Path $backup $name) -Destination (Join-Path $packageRoot $name) }
    } catch {
        Write-Warning "Automatic rollback could not finish: $($_.Exception.Message). Originals are in '$backup'; keep Unity closed and restore them before continuing."
    }
    throw $failure
} finally {
    if (Test-Path -LiteralPath $stage) {
        try { Remove-Item -LiteralPath $stage -Recurse -Force }
        catch { Write-Warning "Could not remove temporary staging folder '$stage': $($_.Exception.Message)" }
    }
}

Write-Host "SPINE_PACKAGES_INSTALLED: official commit $spineCommit"
Write-Host "Backups: $backup"
Write-Host 'Both Spine packages now use local file: paths. Unrelated package pins were preserved.'
Write-Host "Open '$ProjectPath' in Unity Hub and allow Package Manager to resolve and the Editor to compile."
Write-Host 'This verifies package contents only; it does not claim a successful Unity Editor compile or certify Unity 6000.6 compatibility.'

$ErrorActionPreference = 'Stop'
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $repo
$env:UNITY_SOLO = '1'
$env:PORT = '8081'
$env:HOLDEM_WEB_PORT = '3001'
$env:POKER_PORT = '3004'
$env:HAND_HISTORY_DIR = '.data/unity-solo-hands'
if (-not (Test-Path '.next/BUILD_ID')) {
    npm install --legacy-peer-deps
    npm ci --prefix mini-services/poker-server --include=dev
    npx next build --webpack
    if ($LASTEXITCODE -ne 0) { throw 'Backend build failed' }
    Copy-Item '.next/static' '.next/standalone/.next/static' -Recurse -Force
    Copy-Item 'public' '.next/standalone/public' -Recurse -Force
}
node scripts/start-hosted.mjs

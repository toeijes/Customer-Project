# Dot-source from PowerShell: . ./scripts/use-local-node.ps1
# Installs a project-local official runtime and changes PATH for this session.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$projectRoot = Split-Path $PSScriptRoot -Parent
$nodeRelease = (Get-Content -LiteralPath (Join-Path $projectRoot '.node-version') -Raw).Trim()
if ($nodeRelease -notmatch '^24\.\d+\.\d+$') { throw 'Invalid Node.js release in .node-version' }
$nodeArch = if ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture -eq 'Arm64') { 'arm64' } else { 'x64' }
$archiveName = "node-v$nodeRelease-win-$nodeArch.zip"
$toolsRoot = Join-Path $projectRoot '.tools'
$runtimeRoot = Join-Path $toolsRoot "node-v$nodeRelease-win-$nodeArch"
$nodeExecutable = Join-Path $runtimeRoot 'node.exe'
if (!(Test-Path -LiteralPath $nodeExecutable)) {
    New-Item -ItemType Directory -Path $toolsRoot -Force | Out-Null
    $releaseUrl = "https://nodejs.org/dist/v$nodeRelease"
    $archivePath = Join-Path $toolsRoot $archiveName
    $checksumsPath = Join-Path $toolsRoot "SHASUMS-v$nodeRelease.txt"
    Invoke-WebRequest -UseBasicParsing -TimeoutSec 120 -Uri "$releaseUrl/SHASUMS256.txt" -OutFile $checksumsPath
    Invoke-WebRequest -UseBasicParsing -TimeoutSec 120 -Uri "$releaseUrl/$archiveName" -OutFile $archivePath
    $checksumLine = @(Get-Content -LiteralPath $checksumsPath | Where-Object { $_ -match ("  " + [regex]::Escape($archiveName) + '$') })
    if ($checksumLine.Count -ne 1) { throw 'Release checksum not found' }
    $expectedHash = ($checksumLine[0] -split '\s+')[0]
    if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash -ne $expectedHash) { throw 'Node.js archive checksum mismatch' }
    Expand-Archive -LiteralPath $archivePath -DestinationPath $toolsRoot -Force
}
if ((& $nodeExecutable --version) -ne "v$nodeRelease") { throw 'Unexpected Node.js runtime version' }
$env:PATH = "$runtimeRoot;$env:PATH"
Write-Host "Project session uses Node.js $(& $nodeExecutable --version). Use npm.cmd in PowerShell."

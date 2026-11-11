<#
.SYNOPSIS
  Builds the Chrome Web Store upload package: dist/uk-vehicle-lookup-v<version>.zip
  Only runtime files are included (no tests, docs, store assets, Chromium _metadata).
  Entries use forward slashes, as required by the Chrome Web Store.
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content (Join-Path $root 'manifest.json') -Raw | ConvertFrom-Json
$version = $manifest.version
$include = @('manifest.json', 'popup.html', 'logs.html', 'src', 'styles', 'icons', 'rules')

$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Force -Path $dist | Out-Null
$zipPath = Join-Path $dist "uk-vehicle-lookup-v$version.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')
try {
  foreach ($item in $include) {
    $full = Join-Path $root $item
    if (-not (Test-Path $full)) { throw "Missing required path: $item" }
    $files = if ((Get-Item $full).PSIsContainer) { Get-ChildItem $full -Recurse -File } else { Get-Item $full }
    foreach ($f in $files) {
      $entry = $f.FullName.Substring($root.Length + 1).Replace('\', '/')
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $f.FullName, $entry, 'Optimal') | Out-Null
    }
  }
} finally {
  $zip.Dispose()
}

$count = ([System.IO.Compression.ZipFile]::OpenRead($zipPath)).Entries.Count
Write-Host "Built $zipPath ($count files, $([math]::Round((Get-Item $zipPath).Length / 1KB, 1)) KB)"


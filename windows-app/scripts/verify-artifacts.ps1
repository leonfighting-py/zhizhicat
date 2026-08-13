param(
  [Parameter(Mandatory = $false)]
  [string]$ArtifactDirectory = "outputs/windows",

  [Parameter(Mandatory = $false)]
  [string]$Version = "0.1.0"
)

$ErrorActionPreference = "Stop"
$resolved = (Resolve-Path $ArtifactDirectory).Path
$installer = Join-Path $resolved "ZhizhiPet-Setup-$Version.exe"
$portable = Join-Path $resolved "ZhizhiPet-Portable-$Version.exe"
$checksumFile = Join-Path $resolved "SHA256SUMS.txt"

foreach ($path in @($installer, $portable, $checksumFile)) {
  if (-not (Test-Path $path)) {
    throw "Missing required artifact: $path"
  }
}

foreach ($exe in @($installer, $portable)) {
  if ((Get-Item $exe).Length -le 0) {
    throw "Artifact is empty: $exe"
  }
  $name = Split-Path $exe -Leaf
  $actual = (Get-FileHash $exe -Algorithm SHA256).Hash.ToLowerInvariant()
  $record = Get-Content $checksumFile | Where-Object { $_ -match [regex]::Escape($name) }
  if (-not $record -or -not $record.StartsWith($actual)) {
    throw "SHA-256 mismatch for $name"
  }
}

Write-Host "Verified Zhizhi installer and portable EXE for version $Version."

param(
  [string]$ApiOrigin,
  [string]$MediaOrigin
)

$ErrorActionPreference = 'Stop'

function Ensure-UrlOrExit {
  param(
    [string]$Name,
    [string]$Value
  )

  if (-not $Value) {
    Write-Host "Missing $Name." -ForegroundColor Red
    exit 1
  }

  if (-not ($Value -match '^https?://')) {
    Write-Host "$Name must start with http:// or https://" -ForegroundColor Red
    exit 1
  }
}

try {
  $repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
  $clientDir = Join-Path $repoRoot 'client'

  if (-not (Test-Path $clientDir)) {
    Write-Host "client folder not found at: $clientDir" -ForegroundColor Red
    exit 1
  }

  if (-not $ApiOrigin) {
    $ApiOrigin = Read-Host 'API origin (example: https://api.yourdomain.com)'
  }

  if (-not $MediaOrigin) {
    $MediaOrigin = Read-Host 'Media origin (example: https://media.yourdomain.com)'
  }

  Ensure-UrlOrExit -Name 'ApiOrigin' -Value $ApiOrigin
  Ensure-UrlOrExit -Name 'MediaOrigin' -Value $MediaOrigin

  $ApiOrigin = $ApiOrigin.TrimEnd('/')
  $MediaOrigin = $MediaOrigin.TrimEnd('/')

  $envFile = Join-Path $clientDir '.env.production'
  @(
    "VITE_API_ORIGIN=$ApiOrigin"
    "VITE_MEDIA_ORIGIN=$MediaOrigin"
  ) | Set-Content -Path $envFile -Encoding ascii

  Write-Host "Wrote $envFile" -ForegroundColor Green

  Push-Location $clientDir

  if (-not (Test-Path (Join-Path $clientDir 'node_modules'))) {
    Write-Host 'Installing frontend dependencies...' -ForegroundColor Yellow
    npm install
  }

  Write-Host 'Building frontend for production...' -ForegroundColor Yellow
  npm run build

  # Create compatibility aliases for older cached index HTML references.
  $assetsDir = Join-Path $clientDir 'dist\assets'
  if (Test-Path $assetsDir) {
    $latestJs = Get-ChildItem -Path $assetsDir -Filter 'index-*.js' |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1

    if ($latestJs) {
      $legacyNames = @(
        'index-IxjaiMB8.js',
        'index--68mrlIG.js'
      )

      foreach ($legacyName in $legacyNames) {
        $legacyPath = Join-Path $assetsDir $legacyName
        if (-not (Test-Path $legacyPath)) {
          Copy-Item -Path $latestJs.FullName -Destination $legacyPath
        }
      }
    }
  }

  Pop-Location

  $distDir = Join-Path $clientDir 'dist'
  if (-not (Test-Path $distDir)) {
    Write-Host "Build output not found at: $distDir" -ForegroundColor Red
    exit 1
  }

  $zipPath = Join-Path $repoRoot 'cloudflare-pages-upload.zip'
  if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
  }

  Compress-Archive -Path (Join-Path $distDir '*') -DestinationPath $zipPath -CompressionLevel Optimal

  Write-Host ''
  Write-Host 'DONE: Pages upload package is ready:' -ForegroundColor Green
  Write-Host $zipPath -ForegroundColor Cyan
  Write-Host ''
  Write-Host 'Cloudflare next clicks:' -ForegroundColor White
  Write-Host '1) Workers & Pages > Create application > Pages > Direct Upload' -ForegroundColor Gray
  Write-Host '2) Upload cloudflare-pages-upload.zip' -ForegroundColor Gray

  Start-Process explorer.exe "/select,`"$zipPath`""
}
catch {
  try { Pop-Location } catch {}
  Write-Host "Deploy packaging failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

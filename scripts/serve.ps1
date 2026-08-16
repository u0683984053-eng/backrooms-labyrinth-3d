<#
.SYNOPSIS
  Serves the Backrooms Labyrinth game locally.
.DESCRIPTION
  Starts a simple HTTP server on port 8080.
  Requires Python 3.
#>

$Port = 8080
$Root = Join-Path $PSScriptRoot ".." | Resolve-Path

Write-Host "Backrooms Labyrinth server: http://localhost:$Port" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow

Push-Location -LiteralPath $Root
try {
    python -m http.server $Port
} finally {
    Pop-Location
}

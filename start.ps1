param([int]$Port = 5173)
$ErrorActionPreference = 'Stop'
$projectDir = Join-Path $PSScriptRoot 'petcare'
$nodePath = Join-Path $PSScriptRoot '.runtime\node-v22.23.3-win-x64\node.exe'
if (-not (Test-Path -LiteralPath $nodePath)) { $nodePath = (Get-Command node -ErrorAction Stop).Source }
$env:PATH = (Split-Path $nodePath) + ';' + $env:PATH
Set-Location -LiteralPath $projectDir
if (-not (Test-Path 'node_modules')) { & $nodePath (Join-Path (Split-Path $nodePath) 'node_modules\npm\bin\npm-cli.js') ci --include=dev --include=optional --no-audit --no-fund; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
if (-not (Test-Path '.sites-runtime\migrations-applied.json')) { & $nodePath scripts/run-framework.mjs build; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; & $nodePath scripts/migrate-local.mjs; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
& $nodePath scripts/run-framework.mjs dev --port $Port

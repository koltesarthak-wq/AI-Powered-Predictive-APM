$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$python = Join-Path $projectRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $python)) { throw 'Create the project .venv first.' }
Push-Location $projectRoot
try {
    & $python -m PyInstaller --noconfirm --distpath agent/deployment/release --workpath build/agent AI-Predictive-APM-Agent.spec
    if ($LASTEXITCODE -ne 0) { throw 'Agent build failed.' }
    Write-Output 'Runtime ready. Generate a Windows installer in Application Monitoring.'
} finally { Pop-Location }

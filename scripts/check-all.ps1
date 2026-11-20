# Roda todas as verificações automatizadas no Windows.
# Uso (PowerShell, na raiz do repositório):  powershell -ExecutionPolicy Bypass -File scripts\check-all.ps1
# Pré-requisitos: Node.js 22 LTS, Go 1.24+, npm install já executado.
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $root

function Step($name, [scriptblock]$block) {
  Write-Host "`n==> $name" -ForegroundColor Cyan
  & $block
  if ($LASTEXITCODE -ne 0) { throw "falhou: $name (código $LASTEXITCODE)" }
}

Step 'Go: testes do servidor' { Push-Location signaling-server; go test ./...; Pop-Location }
Step 'PWA: typecheck' { npm run typecheck -w @icam/mobile-pwa }
Step 'PWA: testes unitários' { npm test -w @icam/mobile-pwa }
Step 'PWA: build' { npm run build -w @icam/mobile-pwa }
Step 'Desktop: typecheck e build' { npm run build -w @icam/desktop }
Step 'Integração: pareamento contra servidor real (requer servidor ligado em 8443/8080)' {
  node tests/integration/pairing-e2e.mjs
}
Write-Host "`nTodas as verificações automatizadas passaram." -ForegroundColor Green

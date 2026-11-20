# Testes

Tudo abaixo foi executado neste ambiente Linux, salvo onde indicado. O que não foi executado está marcado como **não executado**.

## Matriz

| Suíte | Onde roda | Comando | Estado |
|---|---|---|---|
| Go unitários e de rotas | Linux | `cd signaling-server && go test ./...` | **passou** |
| Build Go Windows | Linux (cross) | `GOOS=windows go build ./cmd/signaling` | **passou** |
| PWA typecheck | Linux | `npm run typecheck -w @icam/mobile-pwa` | **passou** |
| PWA unitários (vitest, 29 casos) | Linux | `npm test -w @icam/mobile-pwa` | **passou** |
| PWA build + service worker | Linux | `npm run build -w @icam/mobile-pwa` | **passou** |
| PWA e2e no Chromium (câmera falsa) | Linux | `npm run e2e -w @icam/mobile-pwa` | **passou** |
| Pareamento contra servidor real + PWA HTTPS | Linux | `node tests/integration/pairing-e2e.mjs` | **passou** |
| Desktop typecheck + build | Linux | `npm run build -w @icam/desktop` | **passou** |
| Electron real (janela, IPC, QR) | Linux com X virtual | `xvfb-run -a node tests/integration/electron-smoke.mjs` | **passou** |
| Desktop no Windows | Windows | — | **não executado** |
| Câmera real do iPhone 17 | iPhone | — | **não executado** |

## O que cada teste de câmera prova (e não prova)

**`tests/camera/e2e-chromium.mjs`** usa a câmera *falsa* do Chromium.
- Prova: permissão, `getSettings`, medição de frames, classificação, exportação e schema do relatório.
- Verifica invariantes: `accepted` só com resolução, frames e FPS batendo; nenhum alvo confirmado acima do `frameRate` máximo que a câmera reporta.
- **Não prova** nada sobre o iPhone. A câmera falsa aqui anuncia `frameRate max = 20`, então todos os alvos foram corretamente classificados como "abaixo do pedido".

**Medição em 2026-11-20 neste ambiente**: resolução aplicada 3840×2160, FPS medido ~19,8 em todos os alvos. Isso reflete a câmera falsa e o Chromium headless com renderização por software, não o Safari no iPhone.

## Como rodar tudo (Linux)

```bash
cd app-webcam
npm install

# Go
cd signaling-server && go test ./... && cd ..

# PWA
npm run typecheck -w @icam/mobile-pwa
npm test -w @icam/mobile-pwa
npm run build -w @icam/mobile-pwa
CHROME_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome npm run e2e -w @icam/mobile-pwa

# Desktop
npm run build -w @icam/desktop
```

Testes de integração (precisam do servidor rodando):

```bash
# terminal 1
cd signaling-server
go run ./cmd/gencert -certs ./certs
go run ./cmd/signaling -static-dir ../apps/mobile-pwa/dist -certs ./certs

# terminal 2
CHROME_PATH=... node tests/integration/pairing-e2e.mjs
cd desktop && xvfb-run -a node ../tests/integration/electron-smoke.mjs   # Linux
node ..\tests\integration\electron-smoke.mjs                             # Windows
```

## Windows

Ver `scripts/check-all.ps1`. Pré-requisitos: Node.js 22 LTS e Go 1.24+.

## Roteiro de validação no iPhone 17 (Fase 1)

Executar com o iPhone e o PC na mesma rede Wi-Fi, com a CA instalada e confiável (ver `SECURITY.md`):

1. Abrir `https://<IP>:8443/` no Safari. Sem alerta de certificado.
2. Aba **Câmera**: iniciar. Anotar a resolução aplicada e o FPS medido ao vivo.
3. Aba **Diagnóstico**: executar. Exportar o JSON.
4. Repetir com "Trocar para frontal".
5. Instalar o PWA: Compartilhar > "Adicionar à Tela de Início". Abrir pelo ícone e repetir o passo 2 (confirma que a câmera funciona em modo standalone).
6. Anotar: modelo do iPhone, versão do iOS, versão do Safari, horário, e o JSON exportado.

Critérios de aceitação da Fase 1 (a serem registrados):
- [ ] Permissão de câmera concedida e câmera traseira aberta.
- [ ] Relatório exportado com `matrix` completa e `capabilities` preenchida ou marcada como não suportada.
- [ ] Nenhuma linha `accepted` sem os três critérios.
- [ ] Resultado de 4K60 registrado como medido (aceito, abaixo ou recusado), sem promessa.
- [ ] PWA instalado e câmera funcionando no modo standalone.

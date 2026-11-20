# iCam Studio 4K

Transforma o iPhone em webcam para o Windows e para o OBS, sem app nativo, sem Mac e sem Apple Developer Program. O iPhone roda o PWA pelo Safari.

> **Estado:** Fase 0 concluída (fundação) e Fase 1 com código pronto. A captura real precisa ser medida no iPhone 17. Ver [`docs/TESTING.md`](docs/TESTING.md) e [`docs/limitations.md`](docs/limitations.md).

## Estrutura

| Pasta | O que é |
|---|---|
| `apps/mobile-pwa` | PWA do iPhone (captura, diagnóstico, pareamento) |
| `desktop` | App Windows com Electron |
| `signaling-server` | Servidor Go: pareamento, HTTPS local, PWA estático |
| `packages/shared-types` | contratos TypeScript |
| `tests` | e2e no Chromium e integração com servidor e Electron reais |
| `obs` | integração com OBS (Fase 4) |
| `docs` | arquitetura, protocolo, segurança, testes, USB |

## Pré-requisitos (Windows 11)

- Node.js 22 LTS
- Go 1.24 ou superior
- Git
- iPhone 17 com iOS atual, Safari, e o PC na mesma rede Wi-Fi

## Instalação (PowerShell)

```powershell
git clone https://github.com/leozao95lc-jpg/App-Webcam.git
cd App-Webcam
npm install
npm run build -w @icam/mobile-pwa

cd signaling-server
go run ./cmd/gencert -certs .\certs
cd ..
```

O `gencert` gera a CA local e o certificado HTTPS. Ele inclui automaticamente os IPs da máquina. Se o IP do PC mudar, rode o `gencert` de novo.

## Executar

Terminal 1 — servidor:

```powershell
cd signaling-server
go run ./cmd/signaling -static-dir ..\apps\mobile-pwa\dist -certs .\certs
```

Terminal 2 — app Windows:

```powershell
cd desktop
npm start
```

Na janela do app: **Criar sessão de pareamento** mostra o QR code e o código de 6 dígitos.

## Abrir no iPhone

1. Safari: `https://<IP-do-PC>:8443/` (o IP aparece na janela do app). Confirme o alerta de certificado.
2. Instalar a CA local: abra `https://<IP-do-PC>:8443/icam-ca.crt` e instale o perfil. Depois, em **Ajustes > Geral > Sobre > Ajustes de Confiança de Certificado**, ative a confiança total. Detalhes em [`docs/SECURITY.md`](docs/SECURITY.md).
3. Adicionar à tela de início: botão Compartilhar > **Adicionar à Tela de Início**.
4. Abrir o app pelo ícone, aba **Câmera** > **Iniciar câmera**. Ver a resolução e o FPS medido.
5. Aba **Diagnóstico** > **Executar diagnóstico** (cerca de 40 s). Exportar o JSON.
6. Aba **Pareamento**: ler o QR code do PC, ou digitar sessão e código.

## Verificação

```powershell
powershell -ExecutionPolicy Bypass -File scripts\check-all.ps1
```

Lista completa e o que já foi executado em Linux: [`docs/TESTING.md`](docs/TESTING.md).

## Limitações principais

- Não sabemos ainda qual resolução e FPS o Safari entrega no iPhone 17. A matriz de diagnóstico existe para responder isso.
- Nenhum upscaling: abaixo de 3840×2160 não se declara 4K.
- O service worker (cache e instalação completa) só funciona com a CA local confiada.
- Vídeo ao computador (WebRTC), preview no Desktop e OBS ainda não existem.

Lista completa: [`docs/limitations.md`](docs/limitations.md).

# Protocolo (v1 da Fase 0/1)

Este documento cobre a API HTTP atual. O canal de controle em tempo real (WebSocket) e o de vídeo (WebRTC) entram na Fase 2 e serão descritos aqui antes da implementação.

Contratos TypeScript: `packages/shared-types/src/index.ts`. Estruturas Go equivalentes: `signaling-server/internal/httpapi/server.go` e `internal/sessions/manager.go`. Quando um lado mudar, o outro muda no mesmo commit.

## API local (somente loopback, `127.0.0.1:8080`)

### `GET /api/health`
`200` `{"status":"ok","time":"<RFC3339>"}`

### `POST /api/sessions`
Cria a sessão de pareamento. Descarta qualquer sessão ainda aguardando.

`201`
```json
{ "sessionId": "dbf2698041de0cdb487e0d6495909af3", "pairingCode": "165255", "expiresAt": "2026-11-20T18:06:58Z" }
```

### `GET /api/sessions/{id}/status`
`200` `{"state":"waiting|paired|expired|locked","attemptsLeft":4,"expiresAt":"..."}`
`404` sessão desconhecida (ou descartada).

## API pública (HTTPS, `0.0.0.0:8443`)

### `POST /api/pair`
Corpo (máximo 1 KiB): `{"sessionId":"<32 hex>","code":"<6 dígitos>"}`

| Status | `error` | Significado |
|---|---|---|
| `200` | — | `{"token":"<base64url 256 bits>","tokenExpiresAt":"..."}` |
| `401` | `wrong_code` | código incorreto; traz `attemptsLeft` |
| `404` | `not_found` | sessão desconhecida |
| `409` | `already_paired` | código já usado |
| `410` | `expired` | passaram 5 minutos |
| `423` | `locked` | cinco tentativas erradas |
| `400` | `invalid_body` | JSON inválido ou corpo acima de 1 KiB |

### `GET /api/health`
Igual à API local.

### `GET /icam-ca.crt`
Certificado da CA local em DER, `Content-Type: application/x-x509-ca-cert`. Usado para instalar a confiança no iOS (ver `SECURITY.md`).

### Qualquer outro `GET`
Serve o build do PWA (`apps/mobile-pwa/dist`) com fallback para `index.html` em rotas do app.
- Rotas `/api/*` desconhecidas: `404` JSON.
- Métodos diferentes de `GET`/`HEAD`: `405`.

## Fragmento de pareamento (QR code)

```
https://<IP-do-PC>:8443/#pair=<sessionId>.<código>
```

- `sessionId`: 32 caracteres hexadecimais minúsculos.
- `código`: 6 dígitos.
- O fragmento não é enviado ao servidor. O PWA lê com `location.hash`, valida com regex e limpa o fragmento após pareamento bem-sucedido (`history.replaceState`).

## Relatório de compatibilidade (`icam.compatibility.v1`)

Gerado pelo PWA, na aba Diagnóstico, e exportado como `icam-compatibilidade-<data>.json`.

```jsonc
{
  "schema": "icam.compatibility.v1",
  "generatedAt": "2026-11-20T17:47:01.628Z",
  "userAgent": "...",
  "secureContext": true,
  "devices": [{ "deviceId": "...", "label": "...", "facing": "environment|user|unknown" }],
  "capabilities": { "supported": true, "width": { "min": 1, "max": 3840 }, "frameRate": { "min": 0, "max": 20 } },
  "matrix": [
    {
      "target": { "label": "4K 60 FPS", "width": 3840, "height": 2160, "fps": 60 },
      "verdict": "accepted|downgraded|rejected|error",
      "applied": { "width": 3840, "height": 2160, "frameRate": 20 },
      "renderedWidth": 3840, "renderedHeight": 2160,
      "measuredFps": 19.82,
      "fpsMethod": "requestVideoFrameCallback|raf-estimate",
      "durationMs": 6612,
      "note": "..."
    }
  ],
  "limitations": ["..."]
}
```

### Regras de veredito (invariantes testadas)

- `accepted` exige: resolução aplicada = alvo, frames renderizados = alvo, e `measuredFps >= 0,9 × fps do alvo`.
- `rejected`: o navegador recusou a configuração (`OverconstrainedError`).
- `error`: outra falha (permissão, câmera em uso, etc.).
- `downgraded`: entregou vídeo, mas abaixo do pedido. Não se declara o alvo.
- `fpsMethod: raf-estimate` é estimativa. Não serve como prova de FPS.

## Versionamento

- O schema do relatório tem versão no próprio campo (`icam.compatibility.v1`). Mudança incompatível vira `v2`.
- A API HTTP ainda não tem versão explícita. Antes de a primeira versão ser usada fora deste repositório, prefixar com `/api/v1/`.

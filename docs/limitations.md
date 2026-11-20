# Limitações conhecidas

Estado honesto do que existe e do que não existe. Atualizado a cada fase.

## Medido

- Pareamento, tentativas, expiração e uso único: testado contra o servidor real.
- Captura no Chromium com câmera falsa: resolução e FPS medidos, mas o dispositivo falso anuncia `frameRate max = 20`. Isso não representa o iPhone.
- App Electron: janela, IPC, QR e isolamento de contexto testados em Linux com X virtual.

## Não medido ainda

- **Safari no iPhone 17: nada foi medido.** Não sabemos a resolução real nem o FPS real. 4K60 é uma meta, não um resultado.
- **Desktop no Windows 11:** não executado. Build cruzado do Go e build do Electron foram feitos em Linux.
- **Service worker e instalação completa do PWA** exigem a CA local confiada no iPhone. Não testado em aparelho.

## Limitações de plataforma

| Plataforma | Limitação |
|---|---|
| Safari/iOS | Captura exige HTTPS. Sem CA local confiada, o PWA não instala completo. |
| Safari/iOS | `getCapabilities()` pode não existir; quando não existe, a UI diz isso e não presume limites. |
| Safari/iOS | Não há garantia de 60 FPS nem de 4K; o navegador decide, e o relatório mostra o que aconteceu. |
| Safari/iOS | Captura pode parar quando o app vai para segundo plano. |
| Safari/iOS | `requestVideoFrameCallback` ausente leva a uma estimativa de FPS (marcada como `raf-estimate`). |
| Windows | Electron 45 é suportado em Windows 10/11 64 bits; não verificado neste projeto ainda. |
| Rede | Não há descoberta automática (mDNS). O iPhone usa o IP mostrado no app. Se o IP mudar, gerar novo QR. |

## Não implementado

- Transmissão de vídeo ao Desktop (WebRTC): Fase 2.
- Canal WebSocket de controle e telemetria em tempo real: Fase 2.
- Preview no Desktop: Fase 3.
- Controles remotos de zoom, foco e exposição: Fase 3.
- Browser Source do OBS: Fase 4.
- USB: pesquisa em `USB-RESEARCH.md`, Fase 5.
- Instalador do Windows (electron-builder): não iniciado.

## Riscos abertos

1. Safari pode não entregar 4K60 de forma sustentada. Decisão de produto depende da medição.
2. WebRTC no Safari com H.264/HEVC precisa de validação de codec antes de a Fase 2 avançar.
3. Pareamento sem limite por IP (ver `SECURITY.md`).
4. Token só em memória: reiniciar o navegador exige novo pareamento.

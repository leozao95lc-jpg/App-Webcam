# Arquitetura

## Visão

```
  iPhone 17 (Safari, PWA)                 Windows 11
 ┌──────────────────────────┐        ┌──────────────────────────────────────┐
 │ React + Vite + Workbox   │ HTTPS  │ signaling-server (Go, stdlib)        │
 │ CameraManager (getUserMedia)│◄────►│   :8443 público (PWA, pareamento)    │
 │ Diagnóstico de captura   │  LAN   │   :8080 local (só 127.0.0.1)         │
 └──────────────────────────┘        │ desktop (Electron + React)           │
                                     │   processo principal → HTTP local    │
                                     │   renderer → só window.icam (IPC)    │
                                     └──────────────────────────────────────┘
                                       OBS: Browser Source (Fase 4, ainda não)
```

Decisões que moldam tudo:

1. **Sem nativo no iPhone.** O PWA roda no Safari. Não há Xcode, Swift nem Apple Developer Program. A captura passa pelo `getUserMedia`, então os limites são os do Safari, e precisam ser medidos.
2. **O servidor é o único ponto de distribuição.** Haverá um publicador (iPhone) e vários consumidores (Desktop, OBS). Nenhum consumidor abre captura própria.
3. **Medição antes de promessa.** O produto só declara um formato depois que o navegador o entrega e o FPS é medido. A UI mostra o que foi aplicado, não o que foi pedido.
4. **Duas superfícies de rede.** Controle do computador e acesso do iPhone ficam em sockets diferentes.

## Monorepo

```
app-webcam/
├── apps/mobile-pwa/        PWA do iPhone (React 19, Vite 8, vite-plugin-pwa)
│   └── src/
│       ├── app/            shell, abas, CSS do tema escuro
│       ├── camera/         CameraManager, matrix (regras puras), matrixRunner, mensagens
│       ├── capture/        tela de captura com FPS ao vivo
│       ├── diagnostics/    tela de compatibilidade e exportação
│       ├── components/     pareamento
│       ├── services/       cliente da API pública
│       ├── telemetry/      FpsMeter (porta do core C#), medição por requestVideoFrameCallback
│       └── __tests__/      vitest: regras, FPS, erros de câmera, pareamento
├── desktop/                app Windows (Electron 45 + React 19)
│   ├── electron/           processo principal, preload (sandbox), IPC, cliente HTTP local
│   └── src/                renderer: cartões de servidor, pareamento, configurações
├── signaling-server/       servidor Go 1.24 (somente biblioteca padrão)
│   ├── cmd/signaling/      executável do servidor
│   ├── cmd/gencert/        gera CA e certificado de servidor
│   └── internal/
│       ├── sessions/       pareamento, tentativas, expiração, tokens
│       ├── httpapi/        rotas das duas superfícies, PWA estático, cabeçalhos
│       ├── certs/          CA local e certificado com SANs
│       └── security/       geração de segredos (crypto/rand)
├── packages/shared-types/  contratos TypeScript compartilhados
├── packages/config/        tsconfig base
├── tests/camera/           e2e do PWA no Chromium (câmera falsa)
├── tests/integration/      Electron real e pareamento contra o servidor real
├── obs/                    integração OBS (placeholder até a Fase 4)
└── docs/                   este diretório
```

Regras de dependência:
- `shared-types` não depende de nada.
- `apps/mobile-pwa` e `desktop` dependem de `shared-types`. Nunca um do outro.
- `signaling-server` é independente de Node; espelha os contratos à mão. Ao alterar um, alterar o outro no mesmo commit.

## Fluxo de captura (PWA)

1. `CameraManager.initialize()` verifica contexto seguro e `getUserMedia`. Sem HTTPS, falha com mensagem clara.
2. `startCamera()` pede `width`, `height` e `frameRate` como **`ideal`**, com `facingMode: environment`.
3. A faixa aberta é lida com `getSettings()`. O que vale é o que o navegador aplicou.
4. Os frames são contados por `requestVideoFrameCallback` (medição real). Sem esse método, cai para uma estimativa marcada como tal.
5. `getCapabilities()` é lido quando existe. Se o Safari não implementar, a UI diz isso e não inventa limites.
6. O diagnóstico roda a matriz de alvos **um por vez**, sempre fechando a captura antes do próximo. Nunca há duas capturas simultâneas.

## Fluxo de pareamento

Ver `PROTOCOL.md` e `SECURITY.md`. Resumo: Desktop cria sessão → QR com código no fragmento → iPhone envia código → token em memória.

## Roteiro

| Fase | Entrega | Estado |
|---|---|---|
| 0 | Monorepo, PWA, Electron, Go, contratos, HTTPS local | **feito** |
| 1 | Captura no Safari, matriz de compatibilidade, relatório | **código pronto; falta medir no iPhone 17** |
| 2 | WebRTC publisher (iPhone) → receiver (Desktop), sinalização WebSocket, reconexão | não iniciada |
| 3 | Preview no Electron, telemetria completa, controles remotos | não iniciada |
| 4 | Browser Source em `http://127.0.0.1:8765/obs`, teste simultâneo | não iniciada |
| 5 | Pesquisa e PoC de USB (`USB-RESEARCH.md`) | pesquisa inicial |
| 6 | Otimização, 4K60, sessões longas, avaliação de plugin libobs | não iniciada |

Observação sobre a porta da página do OBS: o prompt cita `http://127.0.0.1:8765/obs`. Ainda não há servidor nessa porta; quando a Fase 4 começar, ela entra como terceira superfície, também só em loopback.

## Dependências e versões

| Pacote | Versão | Motivo |
|---|---|---|
| react, react-dom | 19.3 | padrão atual |
| vite | 8.3 | build do PWA |
| vite-plugin-pwa | 2.0 | Workbox para service worker e manifest |
| typescript | 5.9 | fixado na série 5; a série 7 (reescrita em Go) não foi adotada ainda |
| vitest | 5.1 | testes unitários |
| electron | 45.4 | runtime do Desktop |
| qrcode | 1.5 | QR code no Desktop |
| playwright-core | 1.63 | testes de ponta a ponta (usa Chrome já instalado, sem baixar browsers) |
| Go | 1.24 | servidor, sem dependências externas |

Não foi feita análise de compatibilidade de cada dependência com o Windows 11 além do que os testes cobrem. O build do Electron e o teste de integração foram executados em Linux; o Windows ainda precisa de execução própria (ver `TESTING.md`).

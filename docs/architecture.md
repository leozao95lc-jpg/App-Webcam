# Arquitetura — iCam Studio 4K

## 1. Visão geral

```
 iPhone (iOS, Swift)                                 Windows (C#/.NET 10, WPF)
+--------------------------------+                +-----------------------------------------------+
| CameraManager (descoberta)     |                | DeviceDiscovery   ConnectionManager           |
| CaptureEngine (1 sessão AV)    |                |        |                  |                   |
| CameraConfiguration (valida)   |   Wi-Fi / USB  |        +--> IVideoTransport <-+               |
| VideoEncoder (VideoToolbox)    |<==============>|                 |              |              |
| VideoTransport (IVideoTransp.) |   controle +   |          VideoReceiver      CameraController |
| RemoteControl (comandos)       |   vídeo        |                 |                              |
| DeviceStatus (bateria/térmico) |                |           VideoDecoder (1x, HW)               |
+--------------------------------+                |                 |                              |
                                                |           VideoPipeline (fan-out)             |
                                                |             |                    |            |
                                                |      PreviewRenderer     VirtualCamera -> OBS  |
                                                |                                               |
                                                |  SettingsManager    StructuredLogger          |
                                                +-----------------------------------------------+
                 CORE (compartilhado): SharedProtocol, VideoFrame, StreamConfiguration,
                 DeviceInformation, ConnectionStatus, CameraCommand, Telemetry
```

## 2. Princípios

1. **Uma captura no iPhone.** O fluxo é codificado uma vez e entregue ao Desktop. Preview e OBS consomem o mesmo fluxo decodificado.
2. **Decodificar uma vez.** O `VideoPipeline` é o único ponto de decodificação. Sinks recebem a mesma superfície.
3. **Contrato antes de implementação.** Tipos e protocolo estão em `core/` e `docs/protocol.md`. Os dois lados são espelhos testados contra as mesmas fixtures.
4. **Transporte trocável.** `IVideoTransport` isola Wi-Fi, WebRTC e USB.
5. **Nada simulado.** Sem câmera real, a UI mostra "—" e comandos ficam desabilitados.
6. **Validação nos dois lados.** Configuração e comandos são validados antes do envio e de novo ao aplicar.

## 3. Camadas (Desktop)

| Camada | Componentes | Responsabilidade |
|---|---|---|
| Descoberta e sessão | DeviceDiscovery, ConnectionManager | Achar, parear, conectar, reconectar |
| Transporte | IVideoTransport (implementações) | Bytes no fio |
| Vídeo | VideoReceiver, VideoDecoder, VideoPipeline | Receber, decodificar, distribuir |
| Consumidores | PreviewRenderer, VirtualCamera | Mostrar e expor ao OBS |
| Controle | CameraController | Enviar configuração e comandos |
| Suporte | SettingsManager, StructuredLogger | Preferências e logs |
| UI | MainViewModel, MainWindow (WPF, MVVM) | Interação |

## 4. Repositório

```
icam-studio-4k/
├── core/              biblioteca .NET 10 compartilhada (sem UI, sem dependências externas)
├── desktop/           app WPF (iCamStudio.Desktop)
├── mobile/            app iOS (Swift/SwiftUI), gerado com XcodeGen
├── obs/               integração com OBS (câmera virtual; plugin libobs futuro)
├── tests/             testes .NET (core, desktop) e fixtures compartilhadas
├── docs/              arquitetura, protocolo, conexões, componentes, validação
├── icam-studio-4k.slnx
└── README.md
```

Regra: `core/` não referencia `desktop/` nem `mobile/`. `desktop/` depende de `core/`. `mobile/` não é compilado pelo .NET; ele espelha `core/` por documentação e fixtures.

## 5. Decisões registradas

| # | Decisão | Motivo | Estado |
|---|---|---|---|
| D1 | Protocolo de controle em JSON com framing de 4 bytes | Simples de depurar; testável nos dois lados | Adotada |
| D2 | Cabeçalho binário de 28 bytes para vídeo | Overhead baixo; sem parsing de JSON por frame | Adotada |
| D3 | `core` sem dependências externas | Compila e testa em Linux; sem acoplamento a WPF | Adotada |
| D4 | WebRTC como alvo, transporte TCP primeiro | Ver `connections.md` | **Pendente de sua aprovação** |
| D5 | Interface em português; código em inglês | Usuário final em PT-BR; código e logs técnicos padronizados | Adotada |
| D6 | Projeto iOS gerado por XcodeGen (`project.yml`) | `.xcodeproj` não é versionável com segurança por mão | Adotada |
| D7 | Formato de superfície decodificada (D3D11 vs NV12) | Depende de medição na Fase 3 | Aberta |
| D8 | Chave de pareamento: DPAPI (Windows), Keychain (iOS) | Não gravar segredo em texto puro | Proposta |

## 6. Riscos arquiteturais

- **Latência total:** captura → encode → rede → decode → preview. Sem medição, o número é chute. Medir por fase.
- **Ponte WebRTC no Windows:** se não compilar de forma limpa, o caminho de vídeo inteiro muda. Por isso o `IVideoTransport` existe.
- **Câmera virtual e OBS:** a estratégia de exposição (Media Foundation virtual camera ou DirectShow) é a principal incerteza da Fase 4. Ver `components/desktop.md`.
- **Aquecimento do iPhone:** 4K30/60 com HEVC é a carga mais alta do produto. Monitorar `thermal` e reduzir qualidade antes de chegar a `critical`.
- **Dependência de um único desenvolvedor, sem Mac no pipeline:** o código iOS não tem compilação automatizada neste repositório hoje.

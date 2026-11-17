# Componentes: CORE

Biblioteca `core/` (`iCamStudio.Core`, .NET 10, sem dependências externas). Espelhada em Swift no iOS.

| Componente | Arquivo(s) | Função | Status | Testes |
|---|---|---|---|---|
| SharedProtocol | `Protocol/ProtocolCodec.cs`, `ProtocolEnvelope.cs`, `Payloads.cs`, `MessageTypes.cs`, `ProtocolConstants.cs` | Envelope, framing, payloads, tipos de mensagem | Implementado | `ProtocolCodecTests`, `FixtureContractTests` |
| VideoFrame | `Video/VideoFrame.cs`, `VideoCodec.cs` | Unidade de acesso codificada com PTS | Implementado | indireto |
| Cabeçalho de vídeo | `Video/VideoPacketHeader.cs` | Cabeçalho binário de 28 bytes | Implementado | `VideoPacketHeaderTests` |
| StreamConfiguration | `Streaming/StreamConfiguration.cs`, `StreamConfigurationValidator.cs`, `CameraCapability.cs` | Configuração e validação contra capacidades reais | Implementado | `StreamConfigurationValidatorTests` |
| DeviceInformation | `Devices/DeviceInformation.cs` | Identificação do aparelho | Implementado | fixture `hello` |
| ConnectionStatus | `Devices/ConnectionStatus.cs` | Estados da sessão | Implementado | — |
| CameraCommand | `Commands/CameraCommand.cs` | Comandos e validação de faixa | Implementado | `CameraCommandValidatorTests` |
| Telemetry | `Telemetry/TelemetrySnapshot.cs`, `FpsMeter.cs` | Métricas e FPS por janela | Implementado | `FpsMeterTests` |
| IVideoTransport | `Transport/IVideoTransport.cs` | Contrato de transporte | Interface; sem implementação | `VideoPipelineContractTests` (com transporte falso) |
| ReconnectPolicy | `Resilience/ReconnectPolicy.cs` | Backoff de reconexão | Implementado | `ReconnectPolicyTests` |

## Detalhes

**Enquadramento:** `ProtocolCodec.EncodeFrame` / `TryDecodeFrame`. Leitura incompleta retorna `false` sem consumir bytes. Dados inválidos lançam `ProtocolException` com `Code` estável.

**Validação de configuração:** `StreamConfigurationValidator.Validate` exige que resolução, FPS e codec sejam aceitos pelo **mesmo** formato. Hardware sem suporte ao codec gera warning; combinação impossível gera erro com a causa (FPS, codec ou resolução).

**Posse de frames:** `VideoFrame.Payload` é `ReadOnlyMemory<byte>` e vale só durante o callback. Quem precisar guardar deve copiar. Esse contrato precisa ser respeitado pelas Fases 2 e 3.

**Limite de bitrate:** 2 000 a 80 000 kbps são referências. Calibrar na Fase 6.

## Ainda não existe no core

- Serialização para bytes em `IVideoTransport` (hoje é `ProtocolEnvelope` já deserializado).
- Máquina de estados formal de `ConnectionStatus` (apenas o enum).
- Pareamento e criptografia (ver `docs/protocol.md`, seção 6).

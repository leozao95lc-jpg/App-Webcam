using iCamStudio.Core.Commands;
using iCamStudio.Core.Devices;
using iCamStudio.Core.Streaming;
using iCamStudio.Core.Telemetry;

namespace iCamStudio.Core.Protocol;

/// <summary>Payload vazio (ping, pong).</summary>
public sealed record EmptyPayload;

/// <summary>iPhone -> Desktop: identificação e versões de protocolo suportadas pelo app.</summary>
public sealed record HelloPayload(DeviceInformation Device, IReadOnlyList<int> SupportedVersions);

/// <summary>Desktop -> iPhone: aceita ou rejeita a sessão. SessionId só existe quando Accepted.</summary>
public sealed record HelloAckPayload(bool Accepted, int SelectedVersion, Guid? SessionId, string? RejectReason);

/// <summary>Desktop -> iPhone: início do pareamento. Chave pública ECDH em base64 (curva a validar na Fase 2).</summary>
public sealed record PairRequestPayload(string DesktopPublicKey);

/// <summary>iPhone -> Desktop: resposta ao pareamento com a própria chave pública.</summary>
public sealed record PairResponsePayload(string MobilePublicKey, bool Accepted);

/// <summary>Confirmação após o usuário comparar o código de verificação exibido nos dois lados.</summary>
public sealed record PairConfirmPayload(bool Confirmed);

/// <summary>iPhone -> Desktop: câmeras e formatos reais reportados pelo AVFoundation deste aparelho.</summary>
public sealed record CapabilitiesPayload(IReadOnlyList<CameraCapability> Cameras);

/// <summary>Desktop -> iPhone: configuração a aplicar antes de iniciar o stream.</summary>
public sealed record StreamConfigurePayload(StreamConfiguration Configuration);

/// <summary>Desktop -> iPhone: liga (true) ou desliga (false) o envio de vídeo.</summary>
public sealed record StreamStatePayload(bool Streaming);

/// <summary>Desktop -> iPhone: comando de controle de câmera.</summary>
public sealed record CommandPayload(CameraCommand Command);

/// <summary>iPhone -> Desktop: métricas periódicas.</summary>
public sealed record TelemetryPayload(TelemetrySnapshot Snapshot);

/// <summary>Erro reportado por qualquer lado. Code é estável; Message é para exibição/log.</summary>
public sealed record ErrorPayload(string Code, string Message, bool Retryable);

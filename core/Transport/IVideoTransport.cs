using iCamStudio.Core.Devices;
using iCamStudio.Core.Protocol;
using iCamStudio.Core.Video;

namespace iCamStudio.Core.Transport;

/// <summary>Meio físico/lógico de transporte. Cada implementação isola sua tecnologia.</summary>
public enum TransportKind
{
    /// <summary>Wi-Fi/LAN. Implementação inicial de controle: TCP com framing (ver docs/protocol.md).</summary>
    WifiTcp,
    /// <summary>Wi-Fi com WebRTC. Alvo do requisito; exige ponte nativa no Windows (Fase 2, a validar).</summary>
    WifiWebRtc,
    /// <summary>Túnel sobre USB (usbmuxd / Apple Mobile Device). Prova de conceito na Fase 5.</summary>
    UsbTunnel,
}

/// <summary>Endereço de um dispositivo para conexão. Host e porta são nulos/0 em transportes sem rede (ex.: USB com porta local).</summary>
public sealed record DeviceEndpoint(TransportKind Kind, string Host, int Port, string? DeviceId = null);

/// <summary>
/// Contrato único entre o sistema e o meio de transporte. Trocar Wi-Fi por USB ou WebRTC
/// não deve alterar ConnectionManager, VideoPipeline, CameraController nem a UI.
/// </summary>
public interface IVideoTransport : IAsyncDisposable
{
    TransportKind Kind { get; }

    ConnectionStatus Status { get; }

    /// <summary>Disparado quando o status muda. Pode ser chamado em thread de rede.</summary>
    event Action<ConnectionStatus>? StatusChanged;

    /// <summary>Mensagem de controle recebida e já validada quanto a versão e formato.</summary>
    event Action<ProtocolEnvelope>? ControlReceived;

    /// <summary>Frame de vídeo recebido. O buffer é válido apenas durante o callback (ver VideoFrame).</summary>
    event Action<VideoFrame>? VideoFrameReceived;

    Task ConnectAsync(DeviceEndpoint endpoint, CancellationToken cancellationToken);

    Task DisconnectAsync(CancellationToken cancellationToken);

    Task SendControlAsync(ProtocolEnvelope envelope, CancellationToken cancellationToken);
}

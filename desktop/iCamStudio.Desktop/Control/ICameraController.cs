using iCamStudio.Core.Commands;
using iCamStudio.Core.Streaming;

namespace iCamStudio.Desktop.Control;

/// <summary>
/// Envia configuração e comandos de câmera ao iPhone, validando-os localmente antes do envio.
/// Implementação na Fase 2 (envio) e Fase 3 (controles da UI).
/// </summary>
public interface ICameraController
{
    /// <summary>Capacidades reportadas pelo iPhone conectado. Vazio até o handshake terminar.</summary>
    IReadOnlyList<CameraCapability> Cameras { get; }

    Task ApplyConfigurationAsync(StreamConfiguration configuration, CancellationToken cancellationToken);

    Task SendCommandAsync(CameraCommand command, CancellationToken cancellationToken);

    Task SetStreamingAsync(bool streaming, CancellationToken cancellationToken);
}

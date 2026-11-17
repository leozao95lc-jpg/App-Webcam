using iCamStudio.Core.Devices;
using iCamStudio.Core.Transport;

namespace iCamStudio.Desktop.Connection;

/// <summary>
/// Orquestra pareamento, sessão e reconexão automática sobre um IVideoTransport.
/// Não conhece a tecnologia do transporte. Implementação na Fase 2.
/// </summary>
public interface IConnectionManager
{
    ConnectionStatus Status { get; }

    event Action<ConnectionStatus>? StatusChanged;

    Task ConnectAsync(DeviceEndpoint endpoint, CancellationToken cancellationToken);

    Task DisconnectAsync(CancellationToken cancellationToken);
}

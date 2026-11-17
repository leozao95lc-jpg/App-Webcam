namespace iCamStudio.Desktop.Discovery;

/// <summary>iPhone encontrado na rede local (DNS-SD / Bonjour, tipo _icamstudio._tcp).</summary>
public sealed record DiscoveredDevice(string Name, string Host, int Port, string? DeviceId);

/// <summary>Descoberta contínua de iPhones na LAN. Implementação na Fase 2.</summary>
public interface IDeviceDiscovery : IAsyncDisposable
{
    /// <summary>Disparado para cada dispositivo novo ou atualizado. Pode ocorrer em thread de rede.</summary>
    event Action<DiscoveredDevice>? DeviceFound;

    Task StartAsync(CancellationToken cancellationToken);

    Task StopAsync(CancellationToken cancellationToken);
}

namespace iCamStudio.Core.Devices;

/// <summary>Estado da sessão entre Desktop e iPhone, exibido no indicador de conexão.</summary>
public enum ConnectionStatus
{
    Disconnected,
    Discovering,
    Pairing,
    Connecting,
    Connected,
    Streaming,
    Reconnecting,
    Failed,
}

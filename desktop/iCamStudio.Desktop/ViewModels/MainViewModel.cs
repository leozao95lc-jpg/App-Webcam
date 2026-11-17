using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using iCamStudio.Core.Devices;

namespace iCamStudio.Desktop.ViewModels;

/// <summary>
/// ViewModel da janela principal. Fase 0: apenas estado e habilitação de comandos.
/// Valores de telemetria são nulos ("—") até existir conexão real: nada é simulado.
/// </summary>
public partial class MainViewModel : ObservableObject
{
    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(ConnectionText), nameof(IsConnected))]
    [NotifyCanExecuteChangedFor(nameof(StartStreamCommand))]
    [NotifyCanExecuteChangedFor(nameof(StopStreamCommand))]
    private ConnectionStatus _connectionStatus = ConnectionStatus.Disconnected;

    [ObservableProperty]
    private string _bitrateText = "—";

    [ObservableProperty]
    private string _latencyText = "—";

    [ObservableProperty]
    private string _temperatureText = "—";

    [ObservableProperty]
    private string _batteryText = "—";

    [ObservableProperty]
    private string _fpsText = "—";

    public bool IsConnected => ConnectionStatus is ConnectionStatus.Connected or ConnectionStatus.Streaming;

    public string ConnectionText => ConnectionStatus switch
    {
        ConnectionStatus.Disconnected => "Desconectado",
        ConnectionStatus.Discovering => "Procurando iPhone na rede",
        ConnectionStatus.Pairing => "Aguardando pareamento",
        ConnectionStatus.Connecting => "Conectando",
        ConnectionStatus.Connected => "Conectado",
        ConnectionStatus.Streaming => "Transmitindo",
        ConnectionStatus.Reconnecting => "Reconectando",
        ConnectionStatus.Failed => "Falha na conexão",
        _ => "Estado desconhecido",
    };

    [RelayCommand(CanExecute = nameof(CanStartStream))]
    private void StartStream()
    {
        // Habilitado apenas com sessão ativa. Lógica real: Fase 2 (ICameraController.SetStreamingAsync).
    }

    private bool CanStartStream() => ConnectionStatus == ConnectionStatus.Connected;

    [RelayCommand(CanExecute = nameof(CanStopStream))]
    private void StopStream()
    {
        // Habilitado apenas durante a transmissão. Lógica real: Fase 2.
    }

    private bool CanStopStream() => ConnectionStatus == ConnectionStatus.Streaming;
}

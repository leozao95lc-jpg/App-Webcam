namespace iCamStudio.Desktop.VirtualCamera;

/// <summary>
/// Câmera virtual "iCam Studio 4K" que o OBS (e outros apps) enxergam como webcam.
/// Estratégia de implementação e validação de compatibilidade com o OBS: Fase 4.
/// Ver docs/components/desktop.md (VirtualCamera) para o estado de pesquisa e riscos.
/// </summary>
public interface IVirtualCamera : Video.IFrameSink, IAsyncDisposable
{
    bool IsRunning { get; }

    Task StartAsync(CancellationToken cancellationToken);

    Task StopAsync(CancellationToken cancellationToken);
}

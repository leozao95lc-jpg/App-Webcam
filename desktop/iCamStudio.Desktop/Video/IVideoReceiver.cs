using iCamStudio.Core.Transport;
using iCamStudio.Core.Video;

namespace iCamStudio.Desktop.Video;

/// <summary>
/// Recebe frames codificados do transporte e os repassa ao pipeline. Único ponto de entrada de vídeo:
/// a captura do iPhone é uma só, e todos os consumidores leem deste fluxo. Implementação na Fase 3.
/// </summary>
public interface IVideoReceiver : IAsyncDisposable
{
    /// <summary>Vincula o receptor a um transporte. O buffer do frame vale só durante o callback.</summary>
    void Attach(IVideoTransport transport);

    void Detach();

    event Action<VideoFrame>? FrameReceived;
}

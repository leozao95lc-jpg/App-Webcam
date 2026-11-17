using iCamStudio.Core.Video;

namespace iCamStudio.Desktop.Video;

/// <summary>
/// Decodificador H.264/HEVC com aceleração de hardware (Media Foundation / D3D11 VA) quando disponível.
/// Implementação na Fase 3. Fallback por software deve ser sinalizado nos logs e na UI.
/// </summary>
public interface IVideoDecoder : IAsyncDisposable
{
    /// <summary>true se o decodificador usa aceleração de hardware para o codec configurado.</summary>
    bool IsHardwareAccelerated { get; }

    /// <summary>Recria o decodificador para um codec ou resolução. Frames pendentes são descartados.</summary>
    Task ConfigureAsync(VideoCodec codec, int width, int height, CancellationToken cancellationToken);

    /// <summary>Decodifica um frame. O resultado é entregue por <see cref="FrameDecoded"/>.</summary>
    void Submit(VideoFrame frame);

    event Action<DecodedFrame>? FrameDecoded;
}

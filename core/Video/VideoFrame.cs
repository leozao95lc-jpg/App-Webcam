namespace iCamStudio.Core.Video;

/// <summary>
/// Unidade de acesso codificada (um frame H.264/HEVC) com metadados de tempo.
/// Contrato de posse: <see cref="Payload"/> aponta para um buffer que o produtor pode reutilizar
/// após o retorno do evento. Quem precisar guardar o frame deve copiar. Ver docs/components/core.md.
/// </summary>
/// <param name="PresentationTimeUs">Timestamp de apresentação em microssegundos, relógio do iPhone.</param>
public sealed record VideoFrame(
    VideoCodec Codec,
    bool IsKeyframe,
    int Width,
    int Height,
    long PresentationTimeUs,
    ReadOnlyMemory<byte> Payload);

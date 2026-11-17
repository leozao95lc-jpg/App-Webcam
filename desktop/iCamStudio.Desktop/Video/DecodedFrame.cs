namespace iCamStudio.Desktop.Video;

/// <summary>
/// Frame decodificado, entregue aos consumidores (preview e câmera virtual) pelo VideoPipeline.
/// Contrato de posse: <see cref="Surface"/> pertence ao pipeline. Um consumidor que precisar
/// do frame após o retorno do callback deve chamar AddRef (a implementar com o tipo real na Fase 3).
/// O formato real da superfície (D3D11 texture ou NV12 em memória) é decisão pendente da Fase 3.
/// </summary>
public sealed record DecodedFrame(
    int Width,
    int Height,
    long PresentationTimeUs,
    IDisposable Surface);

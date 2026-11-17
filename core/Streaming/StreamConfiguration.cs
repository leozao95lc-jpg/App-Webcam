using iCamStudio.Core.Video;

namespace iCamStudio.Core.Streaming;

/// <summary>Configuração pedida pelo Desktop. Só é válida se <see cref="StreamConfigurationValidator"/> aprovar.</summary>
public sealed record StreamConfiguration(
    string CameraId,
    int Width,
    int Height,
    double Fps,
    VideoCodec Codec,
    int BitrateKbps);

using iCamStudio.Core.Video;

namespace iCamStudio.Core.Streaming;

/// <summary>Posição física da câmera.</summary>
public enum CameraPosition
{
    Unknown,
    Back,
    Front,
    External,
}

/// <summary>
/// Um formato suportado por uma câmera específica. Cada lente pode ter formatos diferentes:
/// nunca assumir que todas suportam 4K ou 60 FPS.
/// </summary>
/// <param name="HardwareEncodeSupported">Se o codificador de hardware (VideoToolbox) aceita este formato.</param>
public sealed record CameraFormat(
    int Width,
    int Height,
    double MinFps,
    double MaxFps,
    IReadOnlyList<VideoCodec> Codecs,
    bool HardwareEncodeSupported);

/// <summary>Capacidades de uma câmera do iPhone, reportadas no handshake.</summary>
/// <param name="CameraId">Identificador AVCaptureDevice.uniqueID.</param>
/// <param name="MaxZoomFactor">Zoom máximo suportado por esta lente (videoMaxZoomFactor).</param>
public sealed record CameraCapability(
    string CameraId,
    string DisplayName,
    CameraPosition Position,
    double MaxZoomFactor,
    IReadOnlyList<CameraFormat> Formats);

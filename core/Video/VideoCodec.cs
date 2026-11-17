namespace iCamStudio.Core.Video;

/// <summary>Codecs de vídeo suportados. Os valores numéricos são o ID no cabeçalho binário de vídeo.</summary>
public enum VideoCodec : byte
{
    H264 = 1,
    Hevc = 2,
}

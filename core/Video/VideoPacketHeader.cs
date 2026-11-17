using System.Buffers.Binary;
using iCamStudio.Core.Protocol;

namespace iCamStudio.Core.Video;

/// <summary>
/// Cabeçalho binário de 28 bytes que precede cada frame de vídeo no transporte. Big-endian.
/// Layout:
///   0-3   magic "iCVF"            4     versão (1)
///   5     codec (VideoCodec)      6     flags (bit0 = keyframe)
///   7     reservado (0)           8-11  largura (u32)
///   12-15 altura (u32)            16-23 PTS em µs (u64)
///   24-27 tamanho do payload (u32)
/// </summary>
public readonly record struct VideoPacketHeader(
    VideoCodec Codec,
    bool IsKeyframe,
    uint Width,
    uint Height,
    ulong PresentationTimeUs,
    uint PayloadLength)
{
    public const int Size = 28;
    public const byte FormatVersion = 1;
    private const byte KeyframeFlag = 0x01;

    private static ReadOnlySpan<byte> Magic => "iCVF"u8;

    /// <summary>Escreve o cabeçalho em <paramref name="destination"/> (mínimo de 28 bytes).</summary>
    public void WriteTo(Span<byte> destination)
    {
        if (destination.Length < Size)
        {
            throw new ArgumentException($"Buffer de destino precisa de pelo menos {Size} bytes.", nameof(destination));
        }
        if (PayloadLength == 0 || PayloadLength > ProtocolConstants.MaxVideoPayloadBytes)
        {
            throw new ProtocolException("video_payload_size", $"Tamanho de payload inválido: {PayloadLength}.");
        }

        Magic.CopyTo(destination);
        destination[4] = FormatVersion;
        destination[5] = (byte)Codec;
        destination[6] = IsKeyframe ? KeyframeFlag : (byte)0;
        destination[7] = 0;
        BinaryPrimitives.WriteUInt32BigEndian(destination[8..], Width);
        BinaryPrimitives.WriteUInt32BigEndian(destination[12..], Height);
        BinaryPrimitives.WriteUInt64BigEndian(destination[16..], PresentationTimeUs);
        BinaryPrimitives.WriteUInt32BigEndian(destination[24..], PayloadLength);
    }

    /// <summary>Lê e valida um cabeçalho. Lança <see cref="ProtocolException"/> se for inválido.</summary>
    public static VideoPacketHeader Parse(ReadOnlySpan<byte> source)
    {
        if (source.Length < Size)
        {
            throw new ProtocolException("video_header_short", "Cabeçalho de vídeo incompleto.");
        }
        if (!source[..4].SequenceEqual(Magic))
        {
            throw new ProtocolException("video_magic", "Magic inválido no cabeçalho de vídeo.");
        }
        if (source[4] != FormatVersion)
        {
            throw new ProtocolException("video_version", $"Versão de formato de vídeo não suportada: {source[4]}.");
        }
        if (source[5] is not ((byte)VideoCodec.H264 or (byte)VideoCodec.Hevc))
        {
            throw new ProtocolException("video_codec", $"Codec de vídeo desconhecido: {source[5]}.");
        }

        var payloadLength = BinaryPrimitives.ReadUInt32BigEndian(source[24..]);
        if (payloadLength == 0 || payloadLength > ProtocolConstants.MaxVideoPayloadBytes)
        {
            throw new ProtocolException("video_payload_size", $"Tamanho de payload inválido: {payloadLength}.");
        }

        return new VideoPacketHeader(
            (VideoCodec)source[5],
            (source[6] & KeyframeFlag) != 0,
            BinaryPrimitives.ReadUInt32BigEndian(source[8..]),
            BinaryPrimitives.ReadUInt32BigEndian(source[12..]),
            BinaryPrimitives.ReadUInt64BigEndian(source[16..]),
            payloadLength);
    }
}

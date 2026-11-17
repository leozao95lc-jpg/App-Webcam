using iCamStudio.Core.Protocol;
using iCamStudio.Core.Video;
using Xunit;

namespace iCamStudio.Core.Tests;

public class VideoPacketHeaderTests
{
    [Fact]
    public void Header_roundtrips_all_fields()
    {
        var header = new VideoPacketHeader(VideoCodec.Hevc, true, 3840, 2160, 1_234_567_890UL, 512_000);
        var buffer = new byte[VideoPacketHeader.Size];

        header.WriteTo(buffer);
        var parsed = VideoPacketHeader.Parse(buffer);

        Assert.Equal(header, parsed);
    }

    [Fact]
    public void Layout_matches_documented_bytes()
    {
        var header = new VideoPacketHeader(VideoCodec.H264, false, 3840, 2160, 0x0102030405060708UL, 1000);
        var buffer = new byte[VideoPacketHeader.Size];
        header.WriteTo(buffer);

        Assert.Equal(new byte[] { 0x69, 0x43, 0x56, 0x46 }, buffer[..4]); // "iCVF"
        Assert.Equal(1, buffer[4]);                 // versão
        Assert.Equal(1, buffer[5]);                 // H264
        Assert.Equal(0, buffer[6]);                 // sem flag de keyframe
        Assert.Equal(new byte[] { 0x00, 0x00, 0x0F, 0x00 }, buffer[8..12]); // 3840
        Assert.Equal(new byte[] { 0x00, 0x00, 0x08, 0x70 }, buffer[12..16]); // 2160
        Assert.Equal(new byte[] { 1, 2, 3, 4, 5, 6, 7, 8 }, buffer[16..24]);
        Assert.Equal(new byte[] { 0x00, 0x00, 0x03, 0xE8 }, buffer[24..28]); // 1000
    }

    [Fact]
    public void Keyframe_flag_is_bit_zero()
    {
        var buffer = new byte[VideoPacketHeader.Size];
        new VideoPacketHeader(VideoCodec.Hevc, true, 1920, 1080, 0, 10).WriteTo(buffer);
        Assert.Equal(0x01, buffer[6]);
    }

    [Fact]
    public void Bad_magic_is_rejected()
    {
        var buffer = new byte[VideoPacketHeader.Size];
        new VideoPacketHeader(VideoCodec.H264, false, 1920, 1080, 0, 10).WriteTo(buffer);
        buffer[0] = 0;

        var ex = Assert.Throws<ProtocolException>(() => VideoPacketHeader.Parse(buffer));
        Assert.Equal("video_magic", ex.Code);
    }

    [Fact]
    public void Unknown_codec_is_rejected()
    {
        var buffer = new byte[VideoPacketHeader.Size];
        new VideoPacketHeader(VideoCodec.H264, false, 1920, 1080, 0, 10).WriteTo(buffer);
        buffer[5] = 9;

        var ex = Assert.Throws<ProtocolException>(() => VideoPacketHeader.Parse(buffer));
        Assert.Equal("video_codec", ex.Code);
    }

    [Fact]
    public void Payload_above_limit_is_rejected_on_write()
    {
        var header = new VideoPacketHeader(VideoCodec.Hevc, true, 3840, 2160, 0, (uint)ProtocolConstants.MaxVideoPayloadBytes + 1);
        var ex = Assert.Throws<ProtocolException>(() => header.WriteTo(new byte[VideoPacketHeader.Size]));
        Assert.Equal("video_payload_size", ex.Code);
    }

    [Fact]
    public void Zero_length_payload_is_rejected_on_parse()
    {
        var buffer = new byte[VideoPacketHeader.Size];
        new VideoPacketHeader(VideoCodec.H264, false, 1920, 1080, 0, 10).WriteTo(buffer);
        buffer[24] = buffer[25] = buffer[26] = buffer[27] = 0;

        var ex = Assert.Throws<ProtocolException>(() => VideoPacketHeader.Parse(buffer));
        Assert.Equal("video_payload_size", ex.Code);
    }

    [Fact]
    public void Short_buffer_is_rejected()
    {
        var ex = Assert.Throws<ProtocolException>(() => VideoPacketHeader.Parse(new byte[10]));
        Assert.Equal("video_header_short", ex.Code);
    }
}

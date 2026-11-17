using System.Buffers.Binary;
using iCamStudio.Core.Commands;
using iCamStudio.Core.Protocol;
using Xunit;

namespace iCamStudio.Core.Tests;

public class ProtocolCodecTests
{
    [Fact]
    public void Envelope_created_with_payload_roundtrips_through_frame()
    {
        var payload = new CommandPayload(new CameraCommand(CameraCommandKind.SetFocusAuto));
        var envelope = ProtocolCodec.CreateEnvelope(MessageTypes.Command, payload, timestampMs: 42);

        var frame = ProtocolCodec.EncodeFrame(envelope);
        Assert.True(ProtocolCodec.TryDecodeFrame(frame, out var decoded, out _));

        var back = ProtocolCodec.ReadPayload<CommandPayload>(decoded!);
        Assert.Equal(CameraCommandKind.SetFocusAuto, back!.Command.Kind);
        Assert.Equal(42, decoded!.TimestampMs);
    }

    [Fact]
    public void Length_prefix_is_big_endian_and_matches_json_size()
    {
        var envelope = ProtocolCodec.CreateEnvelope(MessageTypes.Ping, new EmptyPayload(), 1);
        var frame = ProtocolCodec.EncodeFrame(envelope);

        var declared = BinaryPrimitives.ReadUInt32BigEndian(frame);
        Assert.Equal((uint)(frame.Length - 4), declared);
    }

    [Fact]
    public void Incomplete_frame_returns_false_and_consumes_nothing()
    {
        var frame = ProtocolCodec.EncodeFrame(ProtocolCodec.CreateEnvelope(MessageTypes.Ping, new EmptyPayload(), 1));

        var partial = frame.AsSpan(0, frame.Length - 1);
        Assert.False(ProtocolCodec.TryDecodeFrame(partial, out var envelope, out var consumed));
        Assert.Null(envelope);
        Assert.Equal(0, consumed);
    }

    [Fact]
    public void Two_frames_in_one_buffer_are_decoded_one_at_a_time()
    {
        var a = ProtocolCodec.EncodeFrame(ProtocolCodec.CreateEnvelope(MessageTypes.Ping, new EmptyPayload(), 1));
        var b = ProtocolCodec.EncodeFrame(ProtocolCodec.CreateEnvelope(MessageTypes.Pong, new EmptyPayload(), 2));
        var buffer = a.Concat(b).ToArray();

        Assert.True(ProtocolCodec.TryDecodeFrame(buffer, out var first, out var consumed1));
        Assert.Equal(MessageTypes.Ping, first!.Type);

        Assert.True(ProtocolCodec.TryDecodeFrame(buffer.AsSpan(consumed1), out var second, out _));
        Assert.Equal(MessageTypes.Pong, second!.Type);
    }

    [Fact]
    public void Unsupported_version_is_rejected()
    {
        var json = """{"v":99,"type":"ping","id":"6f1c2b9e-1111-4a2b-9c3d-000000000009","ts":1,"payload":{}}"""u8.ToArray();
        var frame = Prefix(json);

        var ex = Assert.Throws<ProtocolException>(() => ProtocolCodec.TryDecodeFrame(frame, out _, out _));
        Assert.Equal("unsupported_version", ex.Code);
    }

    [Fact]
    public void Missing_type_is_rejected()
    {
        var json = """{"v":1,"type":"  ","id":"6f1c2b9e-1111-4a2b-9c3d-000000000009","ts":1,"payload":{}}"""u8.ToArray();

        var ex = Assert.Throws<ProtocolException>(() => ProtocolCodec.TryDecodeFrame(Prefix(json), out _, out _));
        Assert.Equal("missing_type", ex.Code);
    }

    [Fact]
    public void Malformed_json_is_rejected()
    {
        var json = "{not json"u8.ToArray();

        var ex = Assert.Throws<ProtocolException>(() => ProtocolCodec.TryDecodeFrame(Prefix(json), out _, out _));
        Assert.Equal("invalid_json", ex.Code);
    }

    [Fact]
    public void Declared_length_above_limit_is_rejected_without_waiting_for_body()
    {
        var header = new byte[4];
        BinaryPrimitives.WriteUInt32BigEndian(header, (uint)ProtocolConstants.MaxMessageBytes + 1);

        var ex = Assert.Throws<ProtocolException>(() => ProtocolCodec.TryDecodeFrame(header, out _, out _));
        Assert.Equal("frame_size_invalid", ex.Code);
    }

    [Fact]
    public void Encoding_rejects_oversized_message()
    {
        var huge = new string('x', ProtocolConstants.MaxMessageBytes + 10);
        var envelope = ProtocolCodec.CreateEnvelope(MessageTypes.Error, new ErrorPayload("x", huge, false), 1);

        var ex = Assert.Throws<ProtocolException>(() => ProtocolCodec.EncodeFrame(envelope));
        Assert.Equal("frame_too_large", ex.Code);
    }

    [Fact]
    public void Enums_are_serialized_as_camel_case_strings()
    {
        var envelope = ProtocolCodec.CreateEnvelope(MessageTypes.Command, new CommandPayload(new CameraCommand(CameraCommandKind.SetExposureBias, 1.5)), 1);
        var text = envelope.Payload.GetRawText();

        Assert.Contains("\"kind\":\"setExposureBias\"", text);
    }

    private static byte[] Prefix(byte[] body)
    {
        var frame = new byte[4 + body.Length];
        BinaryPrimitives.WriteUInt32BigEndian(frame, (uint)body.Length);
        body.CopyTo(frame, 4);
        return frame;
    }
}

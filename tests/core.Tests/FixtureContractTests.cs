using iCamStudio.Core.Commands;
using iCamStudio.Core.Protocol;
using iCamStudio.Core.Streaming;
using iCamStudio.Core.Telemetry;
using iCamStudio.Core.Video;
using Xunit;

namespace iCamStudio.Core.Tests;

/// <summary>
/// Garante que as fixtures JSON (fonte única do contrato) são lidas corretamente
/// e que re-serializar produz um envelope equivalente.
/// </summary>
public class FixtureContractTests
{
    private static string ReadFixture(string name)
    {
        var path = Path.Combine(AppContext.BaseDirectory, "fixtures", "protocol", name);
        return File.ReadAllText(path);
    }

    private static ProtocolEnvelope DecodeJson(string json)
    {
        var bytes = System.Text.Encoding.UTF8.GetBytes(json);
        var prefixed = new byte[4 + bytes.Length];
        System.Buffers.Binary.BinaryPrimitives.WriteUInt32BigEndian(prefixed, (uint)bytes.Length);
        bytes.CopyTo(prefixed, 4);

        Assert.True(ProtocolCodec.TryDecodeFrame(prefixed, out var envelope, out var consumed));
        Assert.Equal(prefixed.Length, consumed);
        return envelope!;
    }

    [Fact]
    public void Hello_fixture_reads_device_and_versions()
    {
        var envelope = DecodeJson(ReadFixture("hello.json"));
        Assert.Equal(MessageTypes.Hello, envelope.Type);

        var payload = ProtocolCodec.ReadPayload<HelloPayload>(envelope);
        Assert.NotNull(payload);
        Assert.Equal("iPhone18,1", payload!.Device.Model);
        Assert.Equal([1], payload.SupportedVersions);
    }

    [Fact]
    public void HelloAck_fixture_reads_session()
    {
        var payload = ProtocolCodec.ReadPayload<HelloAckPayload>(DecodeJson(ReadFixture("hello_ack.json")));
        Assert.NotNull(payload);
        Assert.True(payload!.Accepted);
        Assert.NotNull(payload.SessionId);
        Assert.Null(payload.RejectReason);
    }

    [Fact]
    public void Capabilities_fixture_reads_formats_per_camera()
    {
        var payload = ProtocolCodec.ReadPayload<CapabilitiesPayload>(DecodeJson(ReadFixture("capabilities.json")));
        Assert.NotNull(payload);

        var camera = Assert.Single(payload!.Cameras);
        Assert.Equal(10.0, camera.MaxZoomFactor);
        Assert.Equal(CameraPosition.Back, camera.Position);
        Assert.Equal(2, camera.Formats.Count);
        Assert.Equal(3840, camera.Formats[0].Width);
        Assert.Contains(VideoCodec.Hevc, camera.Formats[0].Codecs);
    }

    [Fact]
    public void StreamConfigure_fixture_is_valid_against_its_capabilities()
    {
        var capabilities = ProtocolCodec.ReadPayload<CapabilitiesPayload>(DecodeJson(ReadFixture("capabilities.json")))!;
        var configure = ProtocolCodec.ReadPayload<StreamConfigurePayload>(DecodeJson(ReadFixture("stream_configure.json")))!;

        var result = StreamConfigurationValidator.Validate(configure.Configuration, capabilities.Cameras);
        Assert.True(result.IsValid, string.Join("; ", result.Errors));
        Assert.Equal(VideoCodec.Hevc, configure.Configuration.Codec);
    }

    [Fact]
    public void Command_fixture_reads_kind_and_value()
    {
        var payload = ProtocolCodec.ReadPayload<CommandPayload>(DecodeJson(ReadFixture("command.json")));
        Assert.NotNull(payload);
        Assert.Equal(CameraCommandKind.SetZoom, payload!.Command.Kind);
        Assert.Equal(2.0, payload.Command.Value);
    }

    [Fact]
    public void Telemetry_fixture_reads_thermal_and_battery()
    {
        var payload = ProtocolCodec.ReadPayload<TelemetryPayload>(DecodeJson(ReadFixture("telemetry.json")));
        Assert.NotNull(payload);
        Assert.Equal(ThermalLevel.Nominal, payload!.Snapshot.Thermal);
        Assert.Equal(87, payload.Snapshot.BatteryPercent);
        Assert.False(payload.Snapshot.IsCharging);
    }

    [Fact]
    public void Error_fixture_reads_code_and_retryable()
    {
        var payload = ProtocolCodec.ReadPayload<ErrorPayload>(DecodeJson(ReadFixture("error.json")));
        Assert.NotNull(payload);
        Assert.Equal("camera_interrupted", payload!.Code);
        Assert.True(payload.Retryable);
    }

    [Theory]
    [InlineData("hello.json")]
    [InlineData("hello_ack.json")]
    [InlineData("capabilities.json")]
    [InlineData("stream_configure.json")]
    [InlineData("command.json")]
    [InlineData("telemetry.json")]
    [InlineData("error.json")]
    public void Every_fixture_survives_encode_decode_roundtrip(string name)
    {
        var original = DecodeJson(ReadFixture(name));
        var frame = ProtocolCodec.EncodeFrame(original);

        Assert.True(ProtocolCodec.TryDecodeFrame(frame, out var again, out var consumed));
        Assert.Equal(frame.Length, consumed);
        Assert.Equal(original.Type, again!.Type);
        Assert.Equal(original.Id, again.Id);
        Assert.Equal(original.TimestampMs, again.TimestampMs);
        Assert.Equal(original.Payload.GetRawText(), again.Payload.GetRawText());
    }
}

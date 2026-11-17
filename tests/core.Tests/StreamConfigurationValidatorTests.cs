using iCamStudio.Core.Streaming;
using iCamStudio.Core.Video;
using Xunit;

namespace iCamStudio.Core.Tests;

public class StreamConfigurationValidatorTests
{
    // Lente que aceita 4K só até 30 FPS (HEVC por hardware) e 1080p até 60 FPS (só H.264, sem hardware).
    private static readonly IReadOnlyList<CameraCapability> Cameras =
    [
        new CameraCapability(
            "cam-back-wide",
            "Wide",
            CameraPosition.Back,
            10.0,
            [
                new CameraFormat(3840, 2160, 24, 30, [VideoCodec.H264, VideoCodec.Hevc], HardwareEncodeSupported: true),
                new CameraFormat(1920, 1080, 24, 60, [VideoCodec.H264], HardwareEncodeSupported: false),
            ]),
    ];

    private static StreamConfiguration Config(int w = 3840, int h = 2160, double fps = 30, VideoCodec codec = VideoCodec.Hevc, int bitrate = 35_000, string camera = "cam-back-wide")
        => new(camera, w, h, fps, codec, bitrate);

    [Fact]
    public void Supported_4k30_hevc_is_valid_without_warnings()
    {
        var result = StreamConfigurationValidator.Validate(Config(), Cameras);

        Assert.True(result.IsValid);
        Assert.Empty(result.Warnings);
    }

    [Fact]
    public void Four_k_60_is_rejected_because_this_lens_only_goes_to_30()
    {
        var result = StreamConfigurationValidator.Validate(Config(fps: 60), Cameras);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.Contains("60 FPS não é suportado em 3840x2160"));
    }

    [Fact]
    public void Unknown_camera_is_rejected()
    {
        var result = StreamConfigurationValidator.Validate(Config(camera: "cam-front"), Cameras);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.Contains("cam-front"));
    }

    [Fact]
    public void Unsupported_resolution_is_rejected()
    {
        var result = StreamConfigurationValidator.Validate(Config(w: 2560, h: 1440), Cameras);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.Contains("2560x1440"));
    }

    [Fact]
    public void Codec_not_supported_at_resolution_is_rejected()
    {
        // 1080p60 só existe em H.264 nesta lente: HEVC deve ser recusado.
        var result = StreamConfigurationValidator.Validate(Config(w: 1920, h: 1080, fps: 60, codec: VideoCodec.Hevc), Cameras);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.Contains("Codec Hevc"));
    }

    [Fact]
    public void Software_encoding_produces_warning_not_error()
    {
        var result = StreamConfigurationValidator.Validate(Config(w: 1920, h: 1080, fps: 60, codec: VideoCodec.H264, bitrate: 20_000), Cameras);

        Assert.True(result.IsValid);
        Assert.Single(result.Warnings);
    }

    [Theory]
    [InlineData(1_999)]
    [InlineData(80_001)]
    public void Bitrate_outside_bounds_is_rejected(int bitrate)
    {
        var result = StreamConfigurationValidator.Validate(Config(bitrate: bitrate), Cameras);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.Contains("Bitrate"));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-30)]
    [InlineData(double.NaN)]
    public void Non_positive_or_non_finite_fps_is_rejected(double fps)
    {
        var result = StreamConfigurationValidator.Validate(Config(fps: fps), Cameras);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.Contains("FPS deve ser"));
    }

    [Fact]
    public void Fps_inside_range_is_accepted_even_if_not_a_common_value()
    {
        var result = StreamConfigurationValidator.Validate(Config(fps: 27.5), Cameras);
        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validation_runs_against_each_camera_independently()
    {
        var lens2 = new CameraCapability("cam-back-tele", "Tele", CameraPosition.Back, 5.0,
            [new CameraFormat(3840, 2160, 24, 60, [VideoCodec.Hevc], true)]);
        var cameras = Cameras.Append(lens2).ToList();

        var result = StreamConfigurationValidator.Validate(Config(fps: 60, camera: "cam-back-tele"), cameras);
        Assert.True(result.IsValid);
    }
}

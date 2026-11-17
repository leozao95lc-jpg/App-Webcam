using iCamStudio.Core.Streaming;
using iCamStudio.Core.Video;
using iCamStudio.Desktop.Settings;
using Xunit;

namespace iCamStudio.Desktop.Tests;

public class SettingsManagerTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), "icam-tests-" + Guid.NewGuid().ToString("N"));

    private string SettingsPath => Path.Combine(_directory, "settings.json");

    public void Dispose()
    {
        if (Directory.Exists(_directory))
        {
            Directory.Delete(_directory, recursive: true);
        }
    }

    [Fact]
    public async Task Missing_file_returns_defaults()
    {
        var manager = new SettingsManager(SettingsPath);

        var settings = await manager.LoadAsync(CancellationToken.None);

        Assert.Equal(3840, settings.PreferredWidth);
        Assert.Equal(VideoCodec.Hevc, settings.PreferredCodec);
        Assert.Null(settings.LastDeviceId);
    }

    [Fact]
    public async Task Save_then_load_roundtrips_values()
    {
        var manager = new SettingsManager(SettingsPath);
        var original = new AppSettings(LastDeviceId: "dev-1", PreferredFps: 24, PreferredCodec: VideoCodec.H264, BitrateKbps: 20_000);

        await manager.SaveAsync(original, CancellationToken.None);
        var loaded = await manager.LoadAsync(CancellationToken.None);

        Assert.Equal(original, loaded);
        Assert.False(File.Exists(SettingsPath + ".tmp"), "arquivo temporário deve ser removido pelo Move");
    }

    [Fact]
    public async Task Corrupt_file_is_quarantined_and_defaults_are_returned()
    {
        Directory.CreateDirectory(_directory);
        await File.WriteAllTextAsync(SettingsPath, "{ isto não é json");
        var manager = new SettingsManager(SettingsPath);

        var settings = await manager.LoadAsync(CancellationToken.None);

        Assert.Equal(new AppSettings(), settings);
        Assert.True(File.Exists(SettingsPath + ".corrupt"));
        Assert.False(File.Exists(SettingsPath));
    }

    [Fact]
    public async Task Out_of_range_values_are_sanitized_on_load()
    {
        Directory.CreateDirectory(_directory);
        await File.WriteAllTextAsync(SettingsPath, """{"bitrateKbps": 999999, "preferredFps": -5}""");
        var manager = new SettingsManager(SettingsPath);

        var settings = await manager.LoadAsync(CancellationToken.None);

        Assert.Equal(StreamConfigurationValidator.MaxBitrateKbps, settings.BitrateKbps);
        Assert.Equal(30, settings.PreferredFps);
    }
}

using System.Text.Json;
using iCamStudio.Core.Streaming;
using iCamStudio.Core.Video;

namespace iCamStudio.Desktop.Settings;

/// <summary>Preferências persistidas do usuário. Não contém segredos nem chaves de pareamento.</summary>
public sealed record AppSettings(
    string? LastDeviceId = null,
    int PreferredWidth = 3840,
    int PreferredHeight = 2160,
    double PreferredFps = 30,
    VideoCodec PreferredCodec = VideoCodec.Hevc,
    int BitrateKbps = 35_000,
    bool StartVirtualCameraAutomatically = false);

public interface ISettingsManager
{
    Task<AppSettings> LoadAsync(CancellationToken cancellationToken);

    Task SaveAsync(AppSettings settings, CancellationToken cancellationToken);
}

/// <summary>
/// Lê e grava settings.json. Gravação atômica (arquivo temporário + Move).
/// Arquivo corrompido é renomeado para .corrupt e substituído por padrões, sem derrubar o app.
/// </summary>
public sealed class SettingsManager(string filePath) : ISettingsManager
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    public async Task<AppSettings> LoadAsync(CancellationToken cancellationToken)
    {
        if (!File.Exists(filePath))
        {
            return new AppSettings();
        }

        try
        {
            await using var stream = File.OpenRead(filePath);
            var settings = await JsonSerializer.DeserializeAsync<AppSettings>(stream, Options, cancellationToken);
            return settings is null ? new AppSettings() : Sanitize(settings);
        }
        catch (JsonException)
        {
            File.Move(filePath, filePath + ".corrupt", overwrite: true);
            return new AppSettings();
        }
    }

    public async Task SaveAsync(AppSettings settings, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(settings);

        var directory = Path.GetDirectoryName(filePath)
            ?? throw new InvalidOperationException("Caminho de configurações inválido.");
        Directory.CreateDirectory(directory);

        var temp = filePath + ".tmp";
        await using (var stream = File.Create(temp))
        {
            await JsonSerializer.SerializeAsync(stream, Sanitize(settings), Options, cancellationToken);
        }
        File.Move(temp, filePath, overwrite: true);
    }

    /// <summary>Corrige valores fora dos limites do produto para não propagar lixo para a UI.</summary>
    private static AppSettings Sanitize(AppSettings s) => s with
    {
        BitrateKbps = Math.Clamp(s.BitrateKbps, StreamConfigurationValidator.MinBitrateKbps, StreamConfigurationValidator.MaxBitrateKbps),
        PreferredFps = s.PreferredFps > 0 && double.IsFinite(s.PreferredFps) ? s.PreferredFps : 30,
    };
}

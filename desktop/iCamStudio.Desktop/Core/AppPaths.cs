namespace iCamStudio.Desktop.Core;

/// <summary>Locais de dados do aplicativo no Windows (%LOCALAPPDATA%\iCamStudio).</summary>
public static class AppPaths
{
    public static string DataDirectory { get; } =
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "iCamStudio");

    public static string LogsDirectory => Path.Combine(DataDirectory, "logs");

    public static string SettingsFile => Path.Combine(DataDirectory, "settings.json");
}

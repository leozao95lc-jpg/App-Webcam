using System.Windows;
using iCamStudio.Desktop.Core;

namespace iCamStudio.Desktop;

public partial class App : Application
{
    /// <summary>Logger compartilhado do processo. Criado cedo para registrar falhas de inicialização.</summary>
    public static StructuredLogger Log { get; } = new(AppPaths.LogsDirectory);

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        DispatcherUnhandledException += (_, args) =>
        {
            Log.Write(LogLevel.Error, "unhandled_ui_exception", new Dictionary<string, object?>
            {
                ["type"] = args.Exception.GetType().FullName,
                ["message"] = args.Exception.Message,
            });
            args.Handled = false;
        };
        Log.Write(LogLevel.Information, "app_started", new Dictionary<string, object?>
        {
            ["version"] = typeof(App).Assembly.GetName().Version?.ToString(),
        });
    }
}

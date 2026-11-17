using System.Diagnostics;
using System.Text.Json;

namespace iCamStudio.Desktop.Core;

public enum LogLevel
{
    Debug,
    Information,
    Warning,
    Error,
}

/// <summary>
/// Logger em JSON Lines (um objeto por linha, arquivo diário). Campos fixos: ts, level, event.
/// Nunca lança exceção: falha de log não pode derrubar a transmissão.
/// Não registrar dados pessoais nem conteúdo de vídeo.
/// </summary>
public sealed class StructuredLogger(string directory)
{
    private readonly object _gate = new();

    public void Write(LogLevel level, string eventName, IReadOnlyDictionary<string, object?>? data = null)
    {
        try
        {
            var record = new Dictionary<string, object?>
            {
                ["ts"] = DateTimeOffset.UtcNow.ToString("O"),
                ["level"] = level.ToString(),
                ["event"] = eventName,
            };
            if (data is not null)
            {
                foreach (var (key, value) in data)
                {
                    record[key] = value;
                }
            }

            var line = JsonSerializer.Serialize(record);
            Directory.CreateDirectory(directory);
            var path = Path.Combine(directory, $"{DateTime.UtcNow:yyyy-MM-dd}.jsonl");
            lock (_gate)
            {
                File.AppendAllText(path, line + Environment.NewLine);
            }
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException)
        {
            Debug.WriteLine($"Falha ao gravar log '{eventName}': {ex.Message}");
        }
    }
}

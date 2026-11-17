using System.Text.Json;
using iCamStudio.Desktop.Core;
using Xunit;

namespace iCamStudio.Desktop.Tests;

public class StructuredLoggerTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), "icam-log-tests-" + Guid.NewGuid().ToString("N"));

    public void Dispose()
    {
        if (Directory.Exists(_directory))
        {
            Directory.Delete(_directory, recursive: true);
        }
    }

    [Fact]
    public void Writes_one_json_object_per_line_with_fixed_fields()
    {
        var logger = new StructuredLogger(_directory);

        logger.Write(LogLevel.Warning, "reconnect_attempt", new Dictionary<string, object?> { ["attempt"] = 2 });

        var file = Assert.Single(Directory.GetFiles(_directory, "*.jsonl"));
        var line = Assert.Single(File.ReadAllLines(file));
        using var doc = JsonDocument.Parse(line);
        var root = doc.RootElement;

        Assert.Equal("Warning", root.GetProperty("level").GetString());
        Assert.Equal("reconnect_attempt", root.GetProperty("event").GetString());
        Assert.Equal(2, root.GetProperty("attempt").GetInt32());
        Assert.True(root.TryGetProperty("ts", out _));
    }

    [Fact]
    public void Logging_failure_does_not_throw()
    {
        // Caminho inválido: a escrita falha, mas o logger deve engolir a exceção.
        var invalid = Path.Combine(_directory, "arquivo-existente");
        Directory.CreateDirectory(_directory);
        File.WriteAllText(invalid, "bloqueia a criação do diretório de logs");
        var logger = new StructuredLogger(Path.Combine(invalid, "logs"));

        var ex = Record.Exception(() => logger.Write(LogLevel.Error, "boom"));

        Assert.Null(ex);
    }
}

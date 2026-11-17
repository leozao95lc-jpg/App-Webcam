using System.Text.Json;
using System.Text.Json.Serialization;

namespace iCamStudio.Core.Protocol;

/// <summary>
/// Envelope de todas as mensagens de controle. Campos curtos para reduzir overhead:
/// v (versão), type, id (GUID), ts (ms Unix, relógio do emissor), payload (objeto tipado por "type").
/// </summary>
public sealed record ProtocolEnvelope(
    [property: JsonPropertyName("v")] int Version,
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("id")] Guid Id,
    [property: JsonPropertyName("ts")] long TimestampMs,
    [property: JsonPropertyName("payload")] JsonElement Payload);

/// <summary>Erro de formato ou versão no protocolo. Quando lançado, a conexão deve ser encerrada.</summary>
public sealed class ProtocolException(string code, string message) : Exception(message)
{
    /// <summary>Código estável para logs e telemetria (ex.: "unsupported_version").</summary>
    public string Code { get; } = code;
}

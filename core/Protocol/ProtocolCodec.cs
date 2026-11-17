using System.Buffers.Binary;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace iCamStudio.Core.Protocol;

/// <summary>
/// Serialização do envelope e enquadramento (framing) no canal de controle TCP.
/// Formato no fio: [uint32 big-endian: tamanho do JSON] [JSON UTF-8 do ProtocolEnvelope].
/// </summary>
public static class ProtocolCodec
{
    public static readonly JsonSerializerOptions Options = CreateOptions();

    private static JsonSerializerOptions CreateOptions()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        };
        // Enums viajam como string camelCase (ex.: "hevc", "setZoom"). Ver docs/protocol.md.
        options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
        return options;
    }

    /// <summary>Cria um envelope com payload tipado.</summary>
    public static ProtocolEnvelope CreateEnvelope<TPayload>(string type, TPayload payload, long timestampMs, Guid? id = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(type);
        var element = JsonSerializer.SerializeToElement(payload, Options);
        return new ProtocolEnvelope(ProtocolConstants.Version, type, id ?? Guid.NewGuid(), timestampMs, element);
    }

    /// <summary>Lê o payload de um envelope para o tipo esperado. Retorna null se o payload for JSON null.</summary>
    public static TPayload? ReadPayload<TPayload>(ProtocolEnvelope envelope)
    {
        ArgumentNullException.ThrowIfNull(envelope);
        try
        {
            return envelope.Payload.Deserialize<TPayload>(Options);
        }
        catch (JsonException ex)
        {
            throw new ProtocolException("invalid_payload", $"Payload inválido para '{envelope.Type}': {ex.Message}");
        }
    }

    /// <summary>Serializa um envelope já enquadrado (com prefixo de tamanho).</summary>
    public static byte[] EncodeFrame(ProtocolEnvelope envelope)
    {
        ArgumentNullException.ThrowIfNull(envelope);
        ValidateEnvelope(envelope);

        var json = JsonSerializer.SerializeToUtf8Bytes(envelope, Options);
        if (json.Length > ProtocolConstants.MaxMessageBytes)
        {
            throw new ProtocolException("frame_too_large", $"Mensagem de {json.Length} bytes excede o limite de {ProtocolConstants.MaxMessageBytes}.");
        }

        var frame = new byte[ProtocolConstants.FrameLengthPrefixBytes + json.Length];
        BinaryPrimitives.WriteUInt32BigEndian(frame, (uint)json.Length);
        json.CopyTo(frame, ProtocolConstants.FrameLengthPrefixBytes);
        return frame;
    }

    /// <summary>
    /// Tenta decodificar um frame completo do início do buffer.
    /// Retorna false se o frame ainda estiver incompleto (nada consumido).
    /// Lança <see cref="ProtocolException"/> para dados malformados: o chamador deve fechar a conexão.
    /// </summary>
    public static bool TryDecodeFrame(ReadOnlySpan<byte> buffer, out ProtocolEnvelope? envelope, out int consumed)
    {
        envelope = null;
        consumed = 0;

        if (buffer.Length < ProtocolConstants.FrameLengthPrefixBytes)
        {
            return false;
        }

        var length = BinaryPrimitives.ReadUInt32BigEndian(buffer);
        if (length == 0 || length > ProtocolConstants.MaxMessageBytes)
        {
            throw new ProtocolException("frame_size_invalid", $"Tamanho de frame inválido: {length}.");
        }

        var total = ProtocolConstants.FrameLengthPrefixBytes + (int)length;
        if (buffer.Length < total)
        {
            return false;
        }

        var body = buffer.Slice(ProtocolConstants.FrameLengthPrefixBytes, (int)length);
        try
        {
            envelope = JsonSerializer.Deserialize<ProtocolEnvelope>(body, Options)
                ?? throw new ProtocolException("invalid_envelope", "Envelope nulo.");
        }
        catch (JsonException ex)
        {
            throw new ProtocolException("invalid_json", $"JSON malformado: {ex.Message}");
        }

        ValidateEnvelope(envelope);
        consumed = total;
        return true;
    }

    private static void ValidateEnvelope(ProtocolEnvelope envelope)
    {
        if (envelope.Version != ProtocolConstants.Version)
        {
            throw new ProtocolException("unsupported_version", $"Versão de protocolo não suportada: {envelope.Version}.");
        }

        if (string.IsNullOrWhiteSpace(envelope.Type))
        {
            throw new ProtocolException("missing_type", "Envelope sem 'type'.");
        }
    }
}

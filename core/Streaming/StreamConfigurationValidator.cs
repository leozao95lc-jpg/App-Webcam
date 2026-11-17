namespace iCamStudio.Core.Streaming;

/// <summary>Resultado da validação: sem erros = aplicável. Warnings não bloqueiam.</summary>
public sealed record StreamValidationResult(IReadOnlyList<string> Errors, IReadOnlyList<string> Warnings)
{
    public bool IsValid => Errors.Count == 0;
}

/// <summary>
/// Valida uma configuração contra as capacidades REAIS reportadas pelo iPhone.
/// Regra central: resolução, FPS e codec precisam ser aceitos pelo MESMO formato.
/// Mensagens em português porque são exibidas ao usuário.
/// </summary>
public static class StreamConfigurationValidator
{
    /// <summary>
    /// Limites de bitrate. Valores de referência, não medidos: calibrar na Fase 6
    /// (4K30 costuma ficar entre 20 e 40 Mbps; o teto é um palpite conservador).
    /// </summary>
    public const int MinBitrateKbps = 2_000;
    public const int MaxBitrateKbps = 80_000;

    private const double FpsTolerance = 0.01;

    public static StreamValidationResult Validate(StreamConfiguration config, IReadOnlyList<CameraCapability> cameras)
    {
        ArgumentNullException.ThrowIfNull(config);
        ArgumentNullException.ThrowIfNull(cameras);

        var errors = new List<string>();
        var warnings = new List<string>();

        var camera = cameras.FirstOrDefault(c => c.CameraId == config.CameraId);
        if (camera is null)
        {
            errors.Add($"Câmera '{config.CameraId}' não está disponível neste iPhone.");
            return new StreamValidationResult(errors, warnings);
        }

        if (!double.IsFinite(config.Fps) || config.Fps <= 0)
        {
            errors.Add("FPS deve ser um número positivo.");
        }

        if (config.BitrateKbps < MinBitrateKbps || config.BitrateKbps > MaxBitrateKbps)
        {
            errors.Add($"Bitrate deve estar entre {MinBitrateKbps} e {MaxBitrateKbps} kbps.");
        }

        var candidates = camera.Formats
            .Where(f => f.Width == config.Width && f.Height == config.Height)
            .ToList();

        if (candidates.Count == 0)
        {
            errors.Add($"{config.Width}x{config.Height} não é suportado por {camera.DisplayName}.");
            return new StreamValidationResult(errors, warnings);
        }

        var match = candidates.FirstOrDefault(f =>
            config.Fps >= f.MinFps - FpsTolerance &&
            config.Fps <= f.MaxFps + FpsTolerance &&
            f.Codecs.Contains(config.Codec));

        if (match is null)
        {
            var fpsOk = candidates.Any(f => config.Fps >= f.MinFps - FpsTolerance && config.Fps <= f.MaxFps + FpsTolerance);
            var codecOk = candidates.Any(f => f.Codecs.Contains(config.Codec));

            if (!fpsOk)
            {
                var range = string.Join(" ou ", candidates.Select(f => $"{f.MinFps:0.#}-{f.MaxFps:0.#}"));
                errors.Add($"{config.Fps:0.#} FPS não é suportado em {config.Width}x{config.Height} por {camera.DisplayName} (faixas: {range}).");
            }
            if (!codecOk)
            {
                errors.Add($"Codec {config.Codec} não é suportado em {config.Width}x{config.Height} por {camera.DisplayName}.");
            }
            if (fpsOk && codecOk)
            {
                errors.Add($"Combinação de FPS e codec não suportada em {config.Width}x{config.Height} por {camera.DisplayName}.");
            }
            return new StreamValidationResult(errors, warnings);
        }

        if (!match.HardwareEncodeSupported)
        {
            warnings.Add($"{config.Codec} neste formato usaria codificação por software: maior aquecimento e consumo de CPU.");
        }

        return new StreamValidationResult(errors, warnings);
    }
}

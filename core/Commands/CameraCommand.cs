namespace iCamStudio.Core.Commands;

/// <summary>Tipos de comando de controle de câmera enviados do Desktop ao iPhone.</summary>
public enum CameraCommandKind
{
    /// <summary>Zoom em fator (Value: 1.0 até MaxZoomFactor).</summary>
    SetZoom,
    /// <summary>Foco manual, posição da lente (Value: 0.0 perto a 1.0 longe).</summary>
    SetFocusLensPosition,
    /// <summary>Foco automático contínuo. Sem Value.</summary>
    SetFocusAuto,
    /// <summary>Compensação de exposição em EV (Value: -8 a +8).</summary>
    SetExposureBias,
    /// <summary>Exposição automática contínua. Sem Value.</summary>
    SetExposureAuto,
}

/// <param name="Value">Valor numérico, quando o tipo exigir.</param>
public sealed record CameraCommand(CameraCommandKind Kind, double? Value = null);

/// <summary>Validação de comandos antes de enviar ao iPhone (e de novo ao receber, por segurança).</summary>
public static class CameraCommandValidator
{
    public const double MinExposureBias = -8.0;
    public const double MaxExposureBias = 8.0;

    /// <summary>Retorna null se válido; senão, a mensagem de erro em português.</summary>
    public static string? Validate(CameraCommand command, double maxZoomFactor)
    {
        ArgumentNullException.ThrowIfNull(command);

        return command.Kind switch
        {
            CameraCommandKind.SetZoom => RequireRange(command.Value, 1.0, maxZoomFactor, "Zoom"),
            CameraCommandKind.SetFocusLensPosition => RequireRange(command.Value, 0.0, 1.0, "Posição de foco"),
            CameraCommandKind.SetExposureBias => RequireRange(command.Value, MinExposureBias, MaxExposureBias, "Compensação de exposição"),
            CameraCommandKind.SetFocusAuto or CameraCommandKind.SetExposureAuto =>
                command.Value is null ? null : "Comandos automáticos não aceitam valor.",
            _ => "Tipo de comando desconhecido.",
        };
    }

    private static string? RequireRange(double? value, double min, double max, string label)
    {
        if (value is not double v || !double.IsFinite(v))
        {
            return $"{label} exige um valor numérico.";
        }
        return v < min || v > max
            ? $"{label} deve estar entre {min:0.##} e {max:0.##}."
            : null;
    }
}

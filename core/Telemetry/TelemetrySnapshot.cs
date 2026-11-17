namespace iCamStudio.Core.Telemetry;

/// <summary>Estado térmico, espelhando ProcessInfo.ThermalState do iOS.</summary>
public enum ThermalLevel
{
    Unknown,
    Nominal,
    Fair,
    Serious,
    Critical,
}

/// <summary>Métricas enviadas pelo iPhone a cada ~1 s.</summary>
/// <param name="BatteryPercent">Nulo quando o iOS não informa (ex.: bateria não monitorada).</param>
public sealed record TelemetrySnapshot(
    long TimestampMs,
    double Fps,
    int BitrateKbps,
    double EncodeLatencyMs,
    ThermalLevel Thermal,
    int? BatteryPercent,
    bool? IsCharging);

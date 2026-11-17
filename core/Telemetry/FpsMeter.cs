namespace iCamStudio.Core.Telemetry;

/// <summary>
/// Mede FPS real por janela deslizante (padrão 1 s). Não é thread-safe:
/// deve ser usado por um único pipeline de recepção.
/// </summary>
public sealed class FpsMeter
{
    private readonly Queue<long> _timestamps = new();
    private readonly long _windowMs;

    public FpsMeter(long windowMs = 1000)
    {
        if (windowMs <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(windowMs), "A janela deve ser positiva.");
        }
        _windowMs = windowMs;
    }

    /// <summary>Registra um frame no instante <paramref name="timestampMs"/>.</summary>
    public void RecordFrame(long timestampMs)
    {
        _timestamps.Enqueue(timestampMs);
        Trim(timestampMs);
    }

    /// <summary>FPS médio na janela terminando em <paramref name="nowMs"/>.</summary>
    public double GetFps(long nowMs)
    {
        Trim(nowMs);
        return _timestamps.Count * 1000.0 / _windowMs;
    }

    private void Trim(long nowMs)
    {
        var cutoff = nowMs - _windowMs;
        while (_timestamps.Count > 0 && _timestamps.Peek() <= cutoff)
        {
            _timestamps.Dequeue();
        }
    }
}

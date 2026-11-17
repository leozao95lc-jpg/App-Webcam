namespace iCamStudio.Core.Resilience;

/// <summary>
/// Backoff exponencial determinístico para reconexão automática.
/// Sem jitter aleatório de propósito: comportamento reproduzível em teste.
/// Tentativas começam em 1.
/// </summary>
public sealed class ReconnectPolicy
{
    private readonly TimeSpan _initialDelay;
    private readonly double _multiplier;
    private readonly TimeSpan _maxDelay;

    /// <param name="maxAttempts">0 = tentar indefinidamente.</param>
    public ReconnectPolicy(TimeSpan initialDelay, double multiplier, TimeSpan maxDelay, int maxAttempts = 0)
    {
        if (initialDelay <= TimeSpan.Zero) throw new ArgumentOutOfRangeException(nameof(initialDelay));
        if (multiplier < 1.0 || !double.IsFinite(multiplier)) throw new ArgumentOutOfRangeException(nameof(multiplier));
        if (maxDelay < initialDelay) throw new ArgumentOutOfRangeException(nameof(maxDelay), "Deve ser >= initialDelay.");
        if (maxAttempts < 0) throw new ArgumentOutOfRangeException(nameof(maxAttempts));

        _initialDelay = initialDelay;
        _multiplier = multiplier;
        _maxDelay = maxDelay;
        MaxAttempts = maxAttempts;
    }

    /// <summary>Padrão do produto: 0,5 s, 1 s, 2 s, 4 s, 8 s e então 10 s; sem limite de tentativas.</summary>
    public static ReconnectPolicy Default { get; } =
        new(TimeSpan.FromMilliseconds(500), 2.0, TimeSpan.FromSeconds(10), maxAttempts: 0);

    public int MaxAttempts { get; }

    /// <summary>Atraso antes da tentativa <paramref name="attempt"/>, ou null se o limite foi atingido.</summary>
    public TimeSpan? GetDelay(int attempt)
    {
        if (attempt < 1) throw new ArgumentOutOfRangeException(nameof(attempt), "A tentativa começa em 1.");
        if (MaxAttempts > 0 && attempt > MaxAttempts) return null;

        var ms = _initialDelay.TotalMilliseconds * Math.Pow(_multiplier, attempt - 1);
        return TimeSpan.FromMilliseconds(Math.Min(ms, _maxDelay.TotalMilliseconds));
    }
}

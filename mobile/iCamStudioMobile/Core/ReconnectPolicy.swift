import Foundation

/// Port Swift de core/Resilience/ReconnectPolicy.cs. Backoff exponencial determinístico.
struct ReconnectPolicy: Equatable {
    let initialDelay: TimeInterval
    let multiplier: Double
    let maxDelay: TimeInterval
    /// 0 = tentar indefinidamente.
    let maxAttempts: Int

    static let `default` = ReconnectPolicy(initialDelay: 0.5, multiplier: 2.0, maxDelay: 10.0, maxAttempts: 0)

    /// Atraso antes da tentativa `attempt` (começa em 1), ou nil se o limite foi atingido.
    func delay(forAttempt attempt: Int) -> TimeInterval? {
        precondition(attempt >= 1, "A tentativa começa em 1.")
        if maxAttempts > 0 && attempt > maxAttempts { return nil }
        let raw = initialDelay * pow(multiplier, Double(attempt - 1))
        return min(raw, maxDelay)
    }
}

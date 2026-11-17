import Foundation

/// Sessão de captura única (AVCaptureSession). Só existe uma por aparelho: o restante do
/// sistema consome o fluxo codificado, nunca abre outra captura. Implementação na Fase 1.
protocol CaptureEngining: AnyObject {
    /// Aplica formato, FPS e lente. Deve ser validado antes com StreamConfigurationValidator.
    func start(configuration: StreamConfiguration) async throws

    func stop() async
}

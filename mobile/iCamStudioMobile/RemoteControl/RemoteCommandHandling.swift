import Foundation

/// Aplica comandos vindos do Desktop (zoom, foco, exposição) na AVCaptureDevice ativa.
/// Deve validar com CameraCommandValidator antes de tocar no hardware. Implementação na Fase 2/3.
protocol RemoteCommandHandling: AnyObject {
    func apply(_ command: CameraCommand) async throws
}

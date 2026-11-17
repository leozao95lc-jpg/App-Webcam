import Foundation

/// Descoberta de câmeras e formatos reais do aparelho (AVCaptureDevice.DiscoverySession).
/// Contrato da Fase 0. Implementação na Fase 1, sem dados simulados.
protocol CameraManaging: AnyObject {
    /// Câmeras disponíveis, cada uma com os formatos que ELA suporta de fato.
    func discoverCameras() async throws -> [CameraCapability]
}

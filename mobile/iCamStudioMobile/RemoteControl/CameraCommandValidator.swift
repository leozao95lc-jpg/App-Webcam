import Foundation

/// Port Swift de core/Commands/CameraCommand.cs. Validação feita de novo no iPhone, por segurança.
enum CameraCommandValidator {
    static let minExposureBias = -8.0
    static let maxExposureBias = 8.0

    /// nil = válido; senão, mensagem de erro.
    static func validate(_ command: CameraCommand, maxZoomFactor: Double) -> String? {
        switch command.kind {
        case .setZoom:
            return requireRange(command.value, 1.0, maxZoomFactor, label: "Zoom")
        case .setFocusLensPosition:
            return requireRange(command.value, 0.0, 1.0, label: "Posição de foco")
        case .setExposureBias:
            return requireRange(command.value, minExposureBias, maxExposureBias, label: "Compensação de exposição")
        case .setFocusAuto, .setExposureAuto:
            return command.value == nil ? nil : "Comandos automáticos não aceitam valor."
        }
    }

    private static func requireRange(_ value: Double?, _ min: Double, _ max: Double, label: String) -> String? {
        guard let v = value, v.isFinite else {
            return "\(label) exige um valor numérico."
        }
        return (v < min || v > max) ? "\(label) deve estar entre \(min) e \(max)." : nil
    }
}

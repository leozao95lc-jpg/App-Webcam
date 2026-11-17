import Foundation

/// Port Swift de core/Streaming/StreamConfigurationValidator.cs.
/// Os dois lados devem produzir o mesmo resultado: tests/fixtures e os testes de cada plataforma cobrem os mesmos casos.
struct StreamValidationResult: Equatable {
    let errors: [String]
    let warnings: [String]

    var isValid: Bool { errors.isEmpty }
}

enum StreamConfigurationValidator {
    /// Limites de referência, iguais ao C#. Calibrar na Fase 6.
    static let minBitrateKbps = 2_000
    static let maxBitrateKbps = 80_000
    private static let fpsTolerance = 0.01

    static func validate(_ config: StreamConfiguration, cameras: [CameraCapability]) -> StreamValidationResult {
        var errors: [String] = []
        var warnings: [String] = []

        guard let camera = cameras.first(where: { $0.cameraId == config.cameraId }) else {
            errors.append("Câmera '\(config.cameraId)' não está disponível neste iPhone.")
            return StreamValidationResult(errors: errors, warnings: warnings)
        }

        if !config.fps.isFinite || config.fps <= 0 {
            errors.append("FPS deve ser um número positivo.")
        }
        if config.bitrateKbps < minBitrateKbps || config.bitrateKbps > maxBitrateKbps {
            errors.append("Bitrate deve estar entre \(minBitrateKbps) e \(maxBitrateKbps) kbps.")
        }

        let candidates = camera.formats.filter { $0.width == config.width && $0.height == config.height }
        guard !candidates.isEmpty else {
            errors.append("\(config.width)x\(config.height) não é suportado por \(camera.displayName).")
            return StreamValidationResult(errors: errors, warnings: warnings)
        }

        func fpsInRange(_ f: CameraFormat) -> Bool {
            config.fps >= f.minFps - fpsTolerance && config.fps <= f.maxFps + fpsTolerance
        }

        guard let match = candidates.first(where: { fpsInRange($0) && $0.codecs.contains(config.codec) }) else {
            let fpsOk = candidates.contains(where: fpsInRange)
            let codecOk = candidates.contains { $0.codecs.contains(config.codec) }

            if !fpsOk {
                let ranges = candidates.map { "\($0.minFps)-\($0.maxFps)" }.joined(separator: " ou ")
                errors.append("\(config.fps) FPS não é suportado em \(config.width)x\(config.height) por \(camera.displayName) (faixas: \(ranges)).")
            }
            if !codecOk {
                errors.append("Codec \(config.codec.rawValue) não é suportado em \(config.width)x\(config.height) por \(camera.displayName).")
            }
            if fpsOk && codecOk {
                errors.append("Combinação de FPS e codec não suportada em \(config.width)x\(config.height) por \(camera.displayName).")
            }
            return StreamValidationResult(errors: errors, warnings: warnings)
        }

        if !match.hardwareEncodeSupported {
            warnings.append("\(config.codec.rawValue) neste formato usaria codificação por software: maior aquecimento e consumo de CPU.")
        }
        return StreamValidationResult(errors: errors, warnings: warnings)
    }
}

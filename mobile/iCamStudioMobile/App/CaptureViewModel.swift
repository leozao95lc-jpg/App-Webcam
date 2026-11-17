import AVFoundation
import Foundation
import SwiftUI

/// Estado da tela de captura da Fase 1. Lista câmeras reais, deixa escolher o que o formato
/// REALMENTE suporta e inicia/para a captura com o preview local.
@MainActor
final class CaptureViewModel: ObservableObject {

    @Published private(set) var cameras: [CameraCapability] = []
    @Published var selectedCameraId: String? {
        didSet { normalizeSelection() }
    }
    @Published var selectedResolution: String?  // "WIDTHxHEIGHT"
    @Published var selectedFps: Double = 30
    @Published var selectedCodec: VideoCodec = .hevc
    @Published private(set) var isRunning = false
    @Published private(set) var statusText = "Parado"
    @Published private(set) var errorText: String?
    @Published private(set) var encodedFps: Double = 0
    @Published private(set) var bitrateKbps: Int = 0
    @Published private(set) var encoderIsHardware: Bool?

    let bitrateTargetKbps = 35_000

    private let discovery = AVCameraManager()
    private let encoder = VideoToolboxEncoder()
    private lazy var engine = AVCaptureEngine(encoder: encoder)
    private let stats = FrameStats()
    private var statsTimer: Timer?

    var session: AVCaptureSession { engine.session }

    var selectedCamera: CameraCapability? {
        cameras.first { $0.cameraId == selectedCameraId }
    }

    /// Resoluções que a lente escolhida suporta, sem repetição, da maior para a menor.
    var resolutionOptions: [String] {
        guard let camera = selectedCamera else { return [] }
        let unique = Set(camera.formats.map { "\($0.width)x\($0.height)" })
        return unique.sorted { lhs, rhs in pixels(lhs) > pixels(rhs) }
    }

    /// FPS aceitos pela resolução escolhida, dentro de 24, 30 e 60.
    var fpsOptions: [Double] {
        guard let camera = selectedCamera, let resolution = selectedResolution else { return [] }
        let formats = camera.formats.filter { "\($0.width)x\($0.height)" == resolution }
        return [24.0, 30.0, 60.0].filter { fps in
            formats.contains { fps >= $0.minFps - 0.01 && fps <= $0.maxFps + 0.01 }
        }
    }

    /// Codecs aceitos pelo formato escolhido.
    var codecOptions: [VideoCodec] {
        guard let camera = selectedCamera, let resolution = selectedResolution else { return [] }
        let codecs = camera.formats
            .filter { "\($0.width)x\($0.height)" == resolution }
            .flatMap { $0.codecs }
        return [VideoCodec.hevc, .h264].filter { codecs.contains($0) }
    }

    func refreshCameras() async {
        do {
            cameras = try await discovery.discoverCameras()
            if selectedCameraId == nil {
                selectedCameraId = cameras.first?.cameraId
            }
            errorText = nil
        } catch {
            errorText = "Falha ao listar câmeras: \(error.localizedDescription)"
        }
    }

    func start() async {
        guard let camera = selectedCamera, let resolution = selectedResolution,
              let dims = dimensions(of: resolution),
              let codec = codecOptions.first(where: { $0 == selectedCodec }) ?? codecOptions.first else {
            errorText = "Escolha câmera, resolução e codec."
            return
        }
        let (width, height) = dims

        let configuration = StreamConfiguration(
            cameraId: camera.cameraId,
            width: width,
            height: height,
            fps: selectedFps,
            codec: codec,
            bitrateKbps: bitrateTargetKbps
        )

        // Mesma validação do Desktop: se não passa aqui, não chega ao hardware.
        let validation = StreamConfigurationValidator.validate(configuration, cameras: cameras)
        guard validation.isValid else {
            errorText = validation.errors.joined(separator: "\n")
            return
        }

        do {
            statusText = "Iniciando…"
            try await engine.start(configuration: configuration)
            encoderIsHardware = encoder.isHardwareAccelerated
            encoder.onEncodedFrame = { [stats] frame in
                stats.record(bytes: frame.payload.count)
            }
            startStatsTimer()
            isRunning = true
            statusText = "Capturando \(width)x\(height) @ \(Int(selectedFps)) FPS"
            errorText = validation.warnings.first
        } catch {
            statusText = "Parado"
            errorText = "Não foi possível iniciar: \(error)"
        }
    }

    func stop() async {
        statsTimer?.invalidate()
        statsTimer = nil
        await engine.stop()
        isRunning = false
        encodedFps = 0
        bitrateKbps = 0
        statusText = "Parado"
    }

    // MARK: - Estado derivado

    private func normalizeSelection() {
        let resolutions = resolutionOptions
        if selectedResolution == nil || !resolutions.contains(selectedResolution ?? "") {
            selectedResolution = resolutions.first
        }
        if !fpsOptions.contains(selectedFps), let fps = fpsOptions.first {
            selectedFps = fps
        }
        if let codec = codecOptions.first, !codecOptions.contains(selectedCodec) {
            selectedCodec = codec
        }
    }

    private func startStatsTimer() {
        statsTimer?.invalidate()
        statsTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                let snapshot = self.stats.drain()
                self.encodedFps = snapshot.frames
                self.bitrateKbps = Int(snapshot.bytes * 8 / 1000)
            }
        }
    }

    private func pixels(_ resolution: String) -> Int {
        guard let dims = dimensions(of: resolution) else { return 0 }
        return dims.0 * dims.1
    }

    private func dimensions(of resolution: String) -> (Int, Int)? {
        let parts = resolution.split(separator: "x").compactMap { Int($0) }
        guard parts.count == 2 else { return nil }
        return (parts[0], parts[1])
    }
}

/// Contadores de frames e bytes, usados pelo callback do encoder (outra thread).
final class FrameStats: @unchecked Sendable {
    private let lock = NSLock()
    private var frames = 0
    private var bytes = 0

    struct Snapshot {
        let frames: Double
        let bytes: Int
    }

    func record(bytes count: Int) {
        lock.lock()
        frames += 1
        bytes += count
        lock.unlock()
    }

    /// Lê e zera os contadores. Chamado a cada segundo: o resultado é taxa por segundo.
    func drain() -> Snapshot {
        lock.lock()
        defer { lock.unlock() }
        let snapshot = Snapshot(frames: Double(frames), bytes: bytes)
        frames = 0
        bytes = 0
        return snapshot
    }
}

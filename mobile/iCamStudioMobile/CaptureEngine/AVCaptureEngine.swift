import AVFoundation
import CoreMedia
import Foundation
import os

enum CaptureError: Error, Equatable {
    case permissionDenied
    case cameraNotFound(String)
    case formatUnavailable(width: Int, height: Int, fps: Double)
    case cannotAddInput
    case cannotAddOutput
}

/// Uma única AVCaptureSession por aparelho. Os frames vão para o VideoEncoder; o preview
/// local usa a MESMA sessão (`session`), sem abrir outra captura.
///
/// Concorrência: `startRunning`/`stopRunning` são bloqueantes e rodam em fila própria.
/// Os callbacks de frame rodam em `sampleQueue`. `@unchecked Sendable` porque o acesso à
/// sessão é serializado pelas filas, não pelo compilador.
final class AVCaptureEngine: NSObject, CaptureEngining, AVCaptureVideoDataOutputSampleBufferDelegate, @unchecked Sendable {

    let session = AVCaptureSession()

    private let output = AVCaptureVideoDataOutput()
    private let encoder: VideoEncoding
    private let sampleQueue = DispatchQueue(label: "dev.icamstudio.capture.samples", qos: .userInteractive)
    private let sessionQueue = DispatchQueue(label: "dev.icamstudio.capture.session")
    private let log = Logger(subsystem: "dev.icamstudio", category: "capture")

    private(set) var activeDevice: AVCaptureDevice?

    init(encoder: VideoEncoding) {
        self.encoder = encoder
        super.init()
    }

    func start(configuration: StreamConfiguration) async throws {
        try await requestCameraAccess()

        guard let device = AVCaptureDevice(uniqueID: configuration.cameraId) else {
            throw CaptureError.cameraNotFound(configuration.cameraId)
        }

        try encoder.configure(
            codec: configuration.codec,
            width: configuration.width,
            height: configuration.height,
            fps: configuration.fps,
            bitrateKbps: configuration.bitrateKbps
        )

        try configureSession(device: device, configuration: configuration)

        await runOnSessionQueue { self.session.startRunning() }
        activeDevice = device
        log.info("captura iniciada: câmera=\(configuration.cameraId, privacy: .public) \(configuration.width)x\(configuration.height)@\(configuration.fps)")
    }

    func stop() async {
        await runOnSessionQueue { self.session.stopRunning() }
        encoder.invalidate()
        activeDevice = nil
        log.info("captura parada")
    }

    // MARK: - Configuração

    private func configureSession(device: AVCaptureDevice, configuration: StreamConfiguration) throws {
        session.beginConfiguration()
        defer { session.commitConfiguration() }

        session.sessionPreset = .inputPriority

        for existing in session.inputs {
            session.removeInput(existing)
        }
        let input = try AVCaptureDeviceInput(device: device)
        guard session.canAddInput(input) else { throw CaptureError.cannotAddInput }
        session.addInput(input)

        if !session.outputs.contains(output) {
            output.alwaysDiscardsLateVideoFrames = true
            output.videoSettings = [
                kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange,
            ]
            output.setSampleBufferDelegate(self, queue: sampleQueue)
            guard session.canAddOutput(output) else { throw CaptureError.cannotAddOutput }
            session.addOutput(output)
        }

        try applyFormat(to: device, configuration: configuration)
    }

    /// Escolhe o AVCaptureDevice.Format que casa resolução E faixa de FPS, e trava o FPS.
    private func applyFormat(to device: AVCaptureDevice, configuration: StreamConfiguration) throws {
        let tolerance = 0.01
        let match = device.formats.first { format in
            let dims = CMVideoFormatDescriptionGetDimensions(format.formatDescription)
            guard Int(dims.width) == configuration.width, Int(dims.height) == configuration.height else { return false }
            return format.videoSupportedFrameRateRanges.contains { range in
                configuration.fps >= range.minFrameRate - tolerance && configuration.fps <= range.maxFrameRate + tolerance
            }
        }
        guard let format = match else {
            throw CaptureError.formatUnavailable(width: configuration.width, height: configuration.height, fps: configuration.fps)
        }

        try device.lockForConfiguration()
        defer { device.unlockForConfiguration() }

        device.activeFormat = format
        // Duração de frame em racional: 100/(fps*100). Cobre 24, 30, 60 e 29,97 sem arredondar para inteiro.
        let timescale = Int32((configuration.fps * 100).rounded())
        let frameDuration = CMTime(value: 100, timescale: timescale)
        device.activeVideoMinFrameDuration = frameDuration
        device.activeVideoMaxFrameDuration = frameDuration
    }

    private func requestCameraAccess() async throws {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            return
        case .notDetermined:
            let granted = await withCheckedContinuation { (continuation: CheckedContinuation<Bool, Never>) in
                AVCaptureDevice.requestAccess(for: .video) { continuation.resume(returning: $0) }
            }
            if !granted { throw CaptureError.permissionDenied }
        default:
            throw CaptureError.permissionDenied
        }
    }

    private func runOnSessionQueue(_ work: @escaping () -> Void) async {
        await withCheckedContinuation { continuation in
            sessionQueue.async {
                work()
                continuation.resume()
            }
        }
    }

    // MARK: - AVCaptureVideoDataOutputSampleBufferDelegate

    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        let presentationTime = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
        do {
            try encoder.encode(pixelBuffer, presentationTime: presentationTime)
        } catch {
            // Erro por frame não derruba a sessão; a Fase 2 conta e reporta via ErrorPayload.
            log.error("falha ao codificar frame: \(String(describing: error), privacy: .public)")
        }
    }
}

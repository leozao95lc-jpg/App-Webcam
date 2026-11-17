import CoreMedia
import CoreVideo
import Foundation

/// Frame codificado pronto para transporte (unidade de acesso H.264/HEVC).
struct EncodedFrame: Equatable {
    let codec: VideoCodec
    let isKeyframe: Bool
    let width: Int
    let height: Int
    let presentationTimeUs: Int64
    let payload: Data
}

/// Codificação por hardware (VideoToolbox). Implementação na Fase 1/2.
/// Sem fallback silencioso para software: se o hardware não aceitar o formato, o erro sobe.
protocol VideoEncoding: AnyObject {
    /// Chamado para cada frame codificado. Pode ser chamado em thread interna do VideoToolbox.
    var onEncodedFrame: ((EncodedFrame) -> Void)? { get set }

    func configure(codec: VideoCodec, width: Int, height: Int, fps: Double, bitrateKbps: Int) throws

    /// Envia um frame cru (420 bi-planar 8 bits, o formato pedido pela captura) para codificação.
    func encode(_ pixelBuffer: CVPixelBuffer, presentationTime: CMTime) throws

    func invalidate()
}

import CoreMedia
import CoreVideo
import Foundation
import os
import VideoToolbox

enum EncoderError: Error, Equatable {
    case notConfigured
    case sessionCreateFailed(OSStatus)
    case encodeFailed(OSStatus)
}

/// Codificador VideoToolbox (H.264 ou HEVC). Pede hardware, mas NÃO exige:
/// se o sistema cair para software, `isHardwareAccelerated` fica false e isso é logado.
///
/// Formato do payload enviado (decisão registrada em docs/protocol.md, seção 5.3):
/// NAL units com prefixo de tamanho de 4 bytes (AVCC/HVCC), e os conjuntos de parâmetros
/// (SPS/PPS, ou VPS/SPS/PPS para HEVC) inseridos no próprio payload de cada keyframe.
final class VideoToolboxEncoder: VideoEncoding, @unchecked Sendable {

    var onEncodedFrame: ((EncodedFrame) -> Void)?

    /// Lido após `configure`. Falso significa codificação por software.
    private(set) var isHardwareAccelerated = false

    private var session: VTCompressionSession?
    private var codec: VideoCodec = .hevc
    private var width = 0
    private var height = 0
    private let log = Logger(subsystem: "dev.icamstudio", category: "encoder")

    func configure(codec: VideoCodec, width: Int, height: Int, fps: Double, bitrateKbps: Int) throws {
        invalidate()
        self.codec = codec
        self.width = width
        self.height = height

        let codecType: CMVideoCodecType = codec == .hevc ? kCMVideoCodecType_HEVC : kCMVideoCodecType_H264

        // encoderSpecification = nil: no iOS o VideoToolbox já usa hardware quando disponível.
        // Não forço chave de especificação de macOS. Verificar no primeiro build.
        var created: VTCompressionSession?
        let status = VTCompressionSessionCreate(
            allocator: nil,
            width: Int32(width),
            height: Int32(height),
            codecType: codecType,
            encoderSpecification: nil,
            imageBufferAttributes: nil,
            compressedDataAllocator: nil,
            outputCallback: VideoToolboxEncoder.outputCallback,
            refcon: Unmanaged.passUnretained(self).toOpaque(),
            compressionSessionOut: &created
        )
        guard status == noErr, let created else {
            throw EncoderError.sessionCreateFailed(status)
        }

        VTSessionSetProperty(created, key: kVTCompressionPropertyKey_RealTime, value: kCFBooleanTrue)
        // Sem reordenação de frames B: menor latência, sem atraso de buffer de reordenação.
        VTSessionSetProperty(created, key: kVTCompressionPropertyKey_AllowFrameReordering, value: kCFBooleanFalse)
        VTSessionSetProperty(created, key: kVTCompressionPropertyKey_AverageBitRate, value: NSNumber(value: bitrateKbps * 1000))
        VTSessionSetProperty(created, key: kVTCompressionPropertyKey_ExpectedFrameRate, value: NSNumber(value: fps))
        // Keyframe a cada 2 s: equilíbrio entre tempo de recuperação após perda e custo de bitrate.
        VTSessionSetProperty(created, key: kVTCompressionPropertyKey_MaxKeyFrameInterval, value: NSNumber(value: Int(fps * 2)))
        let profile: CFString = codec == .hevc ? kVTProfileLevel_HEVC_Main_AutoLevel : kVTProfileLevel_H264_High_AutoLevel
        VTSessionSetProperty(created, key: kVTCompressionPropertyKey_ProfileLevel, value: profile)

        VTCompressionSessionPrepareToEncodeFrames(created)

        var usingHardware: CFTypeRef?
        if VTSessionCopyProperty(created, key: kVTCompressionPropertyKey_UsingHardwareAcceleratedVideoEncoder,
                                 allocator: nil, valueOut: &usingHardware) == noErr {
            isHardwareAccelerated = (usingHardware as? Bool) ?? false
        }
        if !isHardwareAccelerated {
            log.warning("encoder por software para \(codec.rawValue, privacy: .public): mais calor e CPU")
        }

        session = created
    }

    func encode(_ pixelBuffer: CVPixelBuffer, presentationTime: CMTime) throws {
        guard let session else { throw EncoderError.notConfigured }
        let status = VTCompressionSessionEncodeFrame(
            session,
            imageBuffer: pixelBuffer,
            presentationTimeStamp: presentationTime,
            duration: .invalid,
            frameProperties: nil,
            sourceFrameRefcon: nil,
            infoFlagsOut: nil
        )
        guard status == noErr else { throw EncoderError.encodeFailed(status) }
    }

    func invalidate() {
        guard let session else { return }
        VTCompressionSessionCompleteFrames(session, untilPresentationTimeStamp: .invalid)
        VTCompressionSessionInvalidate(session)
        self.session = nil
    }

    // MARK: - Saída

    private static let outputCallback: VTCompressionOutputCallback = { refcon, _, status, _, sampleBuffer in
        guard status == noErr, let sampleBuffer, let refcon else { return }
        let encoder = Unmanaged<VideoToolboxEncoder>.fromOpaque(refcon).takeUnretainedValue()
        encoder.handle(sampleBuffer)
    }

    private func handle(_ sample: CMSampleBuffer) {
        guard let dataBuffer = CMSampleBufferGetDataBuffer(sample) else { return }

        let attachments = CMSampleBufferGetSampleAttachmentsArray(sample, createIfNecessary: false) as? [[CFString: Any]]
        let notSync = (attachments?.first?[kCMSampleAttachmentKey_NotSync] as? Bool) ?? false
        let isKeyframe = !notSync

        var payload = Data()
        if isKeyframe, let format = CMSampleBufferGetFormatDescription(sample) {
            for parameterSet in parameterSets(of: format) {
                payload.append(lengthPrefix(for: parameterSet.count))
                payload.append(parameterSet)
            }
        }

        var totalLength = 0
        var pointer: UnsafeMutablePointer<CChar>?
        guard CMBlockBufferGetDataPointer(dataBuffer, atOffset: 0, lengthAtOffsetOut: nil,
                                          totalLengthOut: &totalLength, dataPointerOut: &pointer) == kCMBlockBufferNoErr,
              let pointer else { return }
        payload.append(Data(bytes: pointer, count: totalLength))

        let pts = CMTimeConvertScale(CMSampleBufferGetPresentationTimeStamp(sample), timescale: 1_000_000, method: .default)
        onEncodedFrame?(EncodedFrame(
            codec: codec,
            isKeyframe: isKeyframe,
            width: width,
            height: height,
            presentationTimeUs: pts.value,
            payload: payload
        ))
    }

    private func parameterSets(of format: CMFormatDescription) -> [Data] {
        var count = 0
        switch codec {
        case .h264:
            CMVideoFormatDescriptionGetH264ParameterSetAtIndex(format, parameterSetIndex: 0,
                                                               parameterSetPointerOut: nil, parameterSetSizeOut: nil,
                                                               parameterSetCountOut: &count, nalUnitHeaderLengthOut: nil)
            return (0..<count).compactMap { index in
                var pointer: UnsafePointer<UInt8>?
                var size = 0
                let status = CMVideoFormatDescriptionGetH264ParameterSetAtIndex(format, parameterSetIndex: index,
                                                                                parameterSetPointerOut: &pointer,
                                                                                parameterSetSizeOut: &size,
                                                                                parameterSetCountOut: nil,
                                                                                nalUnitHeaderLengthOut: nil)
                guard status == noErr, let pointer else { return nil }
                return Data(bytes: pointer, count: size)
            }
        case .hevc:
            CMVideoFormatDescriptionGetHEVCParameterSetAtIndex(format, parameterSetIndex: 0,
                                                               parameterSetPointerOut: nil, parameterSetSizeOut: nil,
                                                               parameterSetCountOut: &count, nalUnitHeaderLengthOut: nil)
            return (0..<count).compactMap { index in
                var pointer: UnsafePointer<UInt8>?
                var size = 0
                let status = CMVideoFormatDescriptionGetHEVCParameterSetAtIndex(format, parameterSetIndex: index,
                                                                                parameterSetPointerOut: &pointer,
                                                                                parameterSetSizeOut: &size,
                                                                                parameterSetCountOut: nil,
                                                                                nalUnitHeaderLengthOut: nil)
                guard status == noErr, let pointer else { return nil }
                return Data(bytes: pointer, count: size)
            }
        }
    }

    private func lengthPrefix(for length: Int) -> Data {
        withUnsafeBytes(of: UInt32(length).bigEndian) { Data($0) }
    }
}

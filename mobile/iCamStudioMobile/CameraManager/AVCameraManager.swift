import AVFoundation
import CoreMedia
import Foundation
import VideoToolbox

/// Lista câmeras e formatos REAIS do aparelho. Não há dados simulados.
///
/// Limitação conhecida da API: `VTIsHardwareEncodeSupported` responde por CODEC, não por formato.
/// Logo, `hardwareEncodeSupported` é o mesmo para todos os formatos de um codec. Registrado em docs/limitations.md.
final class AVCameraManager: CameraManaging {

    /// Tipos de lente que o produto usa. Lentes virtuais (triple/dual) são omitidas de propósito:
    /// elas se sobrepõem às físicas e duplicariam entradas.
    private static let deviceTypes: [AVCaptureDevice.DeviceType] = [
        .builtInWideAngleCamera,
        .builtInUltraWideCamera,
        .builtInTelephotoCamera,
    ]

    /// Formatos de pixel que o caminho de captura entende (ver AVCaptureEngine).
    private static let supportedPixelFormats: Set<OSType> = [
        kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange,
        kCVPixelFormatType_420YpCbCr8BiPlanarFullRange,
    ]

    func discoverCameras() async throws -> [CameraCapability] {
        let session = AVCaptureDevice.DiscoverySession(
            deviceTypes: Self.deviceTypes,
            mediaType: .video,
            position: .unspecified
        )

        let h264 = VTIsHardwareEncodeSupported(kCMVideoCodecType_H264)
        let hevc = VTIsHardwareEncodeSupported(kCMVideoCodecType_HEVC)

        return session.devices.map { device in
            Self.capability(for: device, h264Hardware: h264, hevcHardware: hevc)
        }
    }

    /// Converte um AVCaptureDevice em CameraCapability.
    /// Uma entrada por (resolução, faixa de FPS): faixas descontínuas não são achatadas em min..max.
    static func capability(for device: AVCaptureDevice, h264Hardware: Bool, hevcHardware: Bool) -> CameraCapability {
        var formats: [CameraFormat] = []

        for format in device.formats {
            let description = format.formatDescription
            let pixelFormat = CMFormatDescriptionGetMediaSubType(description)
            guard supportedPixelFormats.contains(pixelFormat) else { continue }

            let dimensions = CMVideoFormatDescriptionGetDimensions(description)
            var codecs: [VideoCodec] = []
            if h264Hardware { codecs.append(.h264) }
            if hevcHardware { codecs.append(.hevc) }

            for range in format.videoSupportedFrameRateRanges {
                formats.append(CameraFormat(
                    width: Int(dimensions.width),
                    height: Int(dimensions.height),
                    minFps: range.minFrameRate,
                    maxFps: range.maxFrameRate,
                    codecs: codecs,
                    hardwareEncodeSupported: !codecs.isEmpty
                ))
            }
        }

        return CameraCapability(
            cameraId: device.uniqueID,
            displayName: device.localizedName,
            position: position(of: device),
            maxZoomFactor: Double(device.maxAvailableVideoZoomFactor),
            formats: formats
        )
    }

    private static func position(of device: AVCaptureDevice) -> CameraPosition {
        switch device.position {
        case .back: return .back
        case .front: return .front
        case .unspecified: return device.deviceType == .external ? .external : .unknown
        @unknown default: return .unknown
        }
    }
}

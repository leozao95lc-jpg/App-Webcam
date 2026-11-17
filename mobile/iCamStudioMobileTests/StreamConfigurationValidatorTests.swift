import XCTest
@testable import iCamStudioMobile

/// Mesmos cenários de tests/core.Tests/StreamConfigurationValidatorTests.cs.
final class StreamConfigurationValidatorTests: XCTestCase {

    private let cameras = [
        CameraCapability(
            cameraId: "cam-back-wide", displayName: "Wide", position: .back, maxZoomFactor: 10,
            formats: [
                CameraFormat(width: 3840, height: 2160, minFps: 24, maxFps: 30, codecs: [.h264, .hevc], hardwareEncodeSupported: true),
                CameraFormat(width: 1920, height: 1080, minFps: 24, maxFps: 60, codecs: [.h264], hardwareEncodeSupported: false),
            ]
        ),
    ]

    private func config(width: Int = 3840, height: Int = 2160, fps: Double = 30,
                        codec: VideoCodec = .hevc, bitrate: Int = 35_000,
                        camera: String = "cam-back-wide") -> StreamConfiguration {
        StreamConfiguration(cameraId: camera, width: width, height: height, fps: fps, codec: codec, bitrateKbps: bitrate)
    }

    func testSupported4k30HevcIsValidWithoutWarnings() {
        let result = StreamConfigurationValidator.validate(config(), cameras: cameras)
        XCTAssertTrue(result.isValid)
        XCTAssertTrue(result.warnings.isEmpty)
    }

    func testFourK60IsRejected() {
        let result = StreamConfigurationValidator.validate(config(fps: 60), cameras: cameras)
        XCTAssertFalse(result.isValid)
    }

    func testUnknownCameraIsRejected() {
        XCTAssertFalse(StreamConfigurationValidator.validate(config(camera: "cam-front"), cameras: cameras).isValid)
    }

    func testUnsupportedResolutionIsRejected() {
        XCTAssertFalse(StreamConfigurationValidator.validate(config(width: 2560, height: 1440), cameras: cameras).isValid)
    }

    func testCodecNotSupportedAtResolutionIsRejected() {
        // 1080p60 só existe em H.264 nesta lente.
        XCTAssertFalse(StreamConfigurationValidator.validate(config(width: 1920, height: 1080, fps: 60, codec: .hevc), cameras: cameras).isValid)
    }

    func testSoftwareEncodingProducesWarningNotError() {
        let result = StreamConfigurationValidator.validate(config(width: 1920, height: 1080, fps: 60, codec: .h264, bitrate: 20_000), cameras: cameras)
        XCTAssertTrue(result.isValid)
        XCTAssertEqual(result.warnings.count, 1)
    }

    func testBitrateBoundsAreEnforced() {
        XCTAssertFalse(StreamConfigurationValidator.validate(config(bitrate: 1_999), cameras: cameras).isValid)
        XCTAssertFalse(StreamConfigurationValidator.validate(config(bitrate: 80_001), cameras: cameras).isValid)
    }

    func testNonPositiveOrNaNFpsIsRejected() {
        XCTAssertFalse(StreamConfigurationValidator.validate(config(fps: 0), cameras: cameras).isValid)
        XCTAssertFalse(StreamConfigurationValidator.validate(config(fps: -30), cameras: cameras).isValid)
        XCTAssertFalse(StreamConfigurationValidator.validate(config(fps: .nan), cameras: cameras).isValid)
    }

    func testFpsInsideRangeIsAccepted() {
        XCTAssertTrue(StreamConfigurationValidator.validate(config(fps: 27.5), cameras: cameras).isValid)
    }
}

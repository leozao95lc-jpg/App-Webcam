import XCTest
@testable import iCamStudioMobile

final class ProtocolFramerTests: XCTestCase {

    /// Raiz do repositório, derivada deste arquivo: mobile/iCamStudioMobileTests/<arquivo>.swift
    private var fixturesDirectory: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()  // iCamStudioMobileTests
            .deletingLastPathComponent()  // mobile
            .deletingLastPathComponent()  // raiz do repositório
            .appendingPathComponent("tests/fixtures/protocol")
    }

    private func fixture(_ name: String) throws -> Data {
        try Data(contentsOf: fixturesDirectory.appendingPathComponent(name))
    }

    /// As fixtures são envelopes JSON completos sem prefixo: aqui adicionamos o prefixo de tamanho.
    private func framed(_ json: Data) -> Data {
        var frame = withUnsafeBytes(of: UInt32(json.count).bigEndian) { Data($0) }
        frame.append(json)
        return frame
    }

    func testHelloFixtureDecodes() throws {
        let frame = framed(try fixture("hello.json"))
        let result = try ProtocolFramer.decode(frame, payloadType: HelloPayload.self)

        XCTAssertEqual(result?.envelope.type, MessageType.hello)
        XCTAssertEqual(result?.envelope.payload.device.model, "iPhone18,1")
        XCTAssertEqual(result?.envelope.payload.supportedVersions, [1])
        XCTAssertEqual(result?.consumed, frame.count)
    }

    func testCapabilitiesFixtureDecodesFormatsPerCamera() throws {
        let result = try ProtocolFramer.decode(framed(try fixture("capabilities.json")), payloadType: CapabilitiesPayload.self)
        let camera = try XCTUnwrap(result?.envelope.payload.cameras.first)

        XCTAssertEqual(camera.position, .back)
        XCTAssertEqual(camera.maxZoomFactor, 10.0)
        XCTAssertEqual(camera.formats.count, 2)
        XCTAssertTrue(camera.formats[0].codecs.contains(.hevc))
    }

    func testStreamConfigureFixtureDecodes() throws {
        let result = try ProtocolFramer.decode(framed(try fixture("stream_configure.json")), payloadType: StreamConfigurePayload.self)
        let config = try XCTUnwrap(result?.envelope.payload.configuration)

        XCTAssertEqual(config.width, 3840)
        XCTAssertEqual(config.codec, .hevc)
        XCTAssertEqual(config.bitrateKbps, 35_000)
    }

    func testCommandFixtureDecodes() throws {
        let result = try ProtocolFramer.decode(framed(try fixture("command.json")), payloadType: CommandPayload.self)
        XCTAssertEqual(result?.envelope.payload.command.kind, .setZoom)
        XCTAssertEqual(result?.envelope.payload.command.value, 2.0)
    }

    func testTelemetryFixtureDecodesOptionalBattery() throws {
        let result = try ProtocolFramer.decode(framed(try fixture("telemetry.json")), payloadType: TelemetryPayload.self)
        let snapshot = try XCTUnwrap(result?.envelope.payload.snapshot)

        XCTAssertEqual(snapshot.thermal, .nominal)
        XCTAssertEqual(snapshot.batteryPercent, 87)
        XCTAssertEqual(snapshot.isCharging, false)
    }

    func testErrorFixtureDecodes() throws {
        let result = try ProtocolFramer.decode(framed(try fixture("error.json")), payloadType: ErrorPayload.self)
        XCTAssertEqual(result?.envelope.payload.code, "camera_interrupted")
        XCTAssertEqual(result?.envelope.payload.retryable, true)
    }

    func testEncodeThenDecodeRoundtrip() throws {
        let payload = CommandPayload(command: CameraCommand(kind: .setExposureBias, value: 1.5))
        let frame = try ProtocolFramer.encode(type: MessageType.command, payload: payload, timestampMs: 42)

        let result = try ProtocolFramer.decode(frame, payloadType: CommandPayload.self)
        XCTAssertEqual(result?.envelope.payload, payload)
        XCTAssertEqual(result?.envelope.ts, 42)
    }

    func testIncompleteFrameReturnsNil() throws {
        let frame = framed(try fixture("hello.json"))
        let partial = frame.prefix(frame.count - 1)

        XCTAssertNil(try ProtocolFramer.decode(Data(partial), payloadType: HelloPayload.self))
    }

    func testUnsupportedVersionIsRejected() {
        let json = Data(#"{"v":99,"type":"ping","id":"6F1C2B9E-1111-4A2B-9C3D-000000000009","ts":1,"payload":{}}"#.utf8)

        XCTAssertThrowsError(try ProtocolFramer.decode(framed(json), payloadType: EmptyPayload.self)) { error in
            XCTAssertEqual(error as? ProtocolError, .unsupportedVersion(99))
        }
    }

    func testOversizedDeclaredLengthIsRejectedImmediately() {
        // Só o prefixo de 4 bytes: a rejeição deve acontecer antes de esperar o corpo.
        let header = withUnsafeBytes(of: UInt32(ProtocolFramer.maxMessageBytes + 1).bigEndian) { Data($0) }

        XCTAssertThrowsError(try ProtocolFramer.decode(header, payloadType: EmptyPayload.self)) { error in
            XCTAssertEqual(error as? ProtocolError, .frameSizeInvalid(UInt32(ProtocolFramer.maxMessageBytes + 1)))
        }
    }
}

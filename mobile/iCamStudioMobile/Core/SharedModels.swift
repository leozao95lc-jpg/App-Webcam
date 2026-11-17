import Foundation

// Espelho Swift de core/ (C#). Fonte da verdade: docs/protocol.md e tests/fixtures/protocol/.
// Enums usam rawValue camelCase: é o contrato no fio. Não renomear sem versionar o protocolo.

enum MessageType {
    static let hello = "hello"
    static let helloAck = "hello_ack"
    static let pairRequest = "pair_request"
    static let pairResponse = "pair_response"
    static let pairConfirm = "pair_confirm"
    static let capabilities = "capabilities"
    static let streamConfigure = "stream_configure"
    static let streamState = "stream_state"
    static let command = "command"
    static let telemetry = "telemetry"
    static let error = "error"
    static let ping = "ping"
    static let pong = "pong"
}

/// Cabeçalho sem payload: permite ler "type" antes de decodificar o payload tipado.
struct EnvelopeHeader: Codable, Equatable {
    let v: Int
    let type: String
    let id: UUID
    let ts: Int64
}

struct Envelope<Payload: Codable>: Codable {
    let v: Int
    let type: String
    let id: UUID
    let ts: Int64
    let payload: Payload
}

struct EmptyPayload: Codable, Equatable {}

// MARK: - Estados e enums

enum ConnectionStatus: String, Codable {
    case disconnected, discovering, pairing, connecting, connected, streaming, reconnecting, failed
}

enum CameraPosition: String, Codable {
    case unknown, back, front, external
}

enum VideoCodec: String, Codable {
    case h264, hevc
}

enum ThermalLevel: String, Codable {
    case unknown, nominal, fair, serious, critical
}

enum CameraCommandKind: String, Codable {
    case setZoom, setFocusLensPosition, setFocusAuto, setExposureBias, setExposureAuto
}

// MARK: - Dispositivo e capacidades

struct DeviceInformation: Codable, Equatable {
    let deviceId: String
    let name: String
    let model: String
    let osVersion: String
    let appVersion: String
}

struct CameraFormat: Codable, Equatable {
    let width: Int
    let height: Int
    let minFps: Double
    let maxFps: Double
    let codecs: [VideoCodec]
    let hardwareEncodeSupported: Bool
}

struct CameraCapability: Codable, Equatable {
    let cameraId: String
    let displayName: String
    let position: CameraPosition
    let maxZoomFactor: Double
    let formats: [CameraFormat]
}

// MARK: - Payloads de controle

struct HelloPayload: Codable, Equatable {
    let device: DeviceInformation
    let supportedVersions: [Int]
}

struct HelloAckPayload: Codable, Equatable {
    let accepted: Bool
    let selectedVersion: Int
    let sessionId: UUID?
    let rejectReason: String?
}

struct PairRequestPayload: Codable, Equatable {
    let desktopPublicKey: String
}

struct PairResponsePayload: Codable, Equatable {
    let mobilePublicKey: String
    let accepted: Bool
}

struct PairConfirmPayload: Codable, Equatable {
    let confirmed: Bool
}

struct CapabilitiesPayload: Codable, Equatable {
    let cameras: [CameraCapability]
}

struct StreamConfiguration: Codable, Equatable {
    let cameraId: String
    let width: Int
    let height: Int
    let fps: Double
    let codec: VideoCodec
    let bitrateKbps: Int
}

struct StreamConfigurePayload: Codable, Equatable {
    let configuration: StreamConfiguration
}

struct StreamStatePayload: Codable, Equatable {
    let streaming: Bool
}

struct CameraCommand: Codable, Equatable {
    let kind: CameraCommandKind
    let value: Double?
}

struct CommandPayload: Codable, Equatable {
    let command: CameraCommand
}

struct TelemetrySnapshot: Codable, Equatable {
    let timestampMs: Int64
    let fps: Double
    let bitrateKbps: Int
    let encodeLatencyMs: Double
    let thermal: ThermalLevel
    let batteryPercent: Int?
    let isCharging: Bool?
}

struct TelemetryPayload: Codable, Equatable {
    let snapshot: TelemetrySnapshot
}

struct ErrorPayload: Codable, Equatable {
    let code: String
    let message: String
    let retryable: Bool
}

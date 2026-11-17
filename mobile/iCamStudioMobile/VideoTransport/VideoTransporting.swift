import Foundation

/// Port Swift de core/Transport/IVideoTransport.cs. Trocar o meio (Wi-Fi TCP, WebRTC, USB)
/// não deve alterar CaptureEngine, VideoEncoder nem a UI.
enum TransportKind: String, Codable {
    case wifiTcp, wifiWebRtc, usbTunnel
}

struct DeviceEndpoint: Equatable {
    let kind: TransportKind
    let host: String
    let port: Int
    let deviceId: String?
}

protocol VideoTransporting: AnyObject {
    var kind: TransportKind { get }
    var status: ConnectionStatus { get }

    /// Disparado a cada mudança de status. Pode vir de thread de rede: o consumidor troca para @MainActor.
    var onStatusChanged: ((ConnectionStatus) -> Void)? { get set }

    /// Mensagem de controle recebida, ainda codificada (framing já removido).
    var onControlMessage: ((Data) -> Void)? { get set }

    func connect(to endpoint: DeviceEndpoint) async throws

    func disconnect() async

    func sendControl(_ frame: Data) async throws

    func sendVideo(_ frame: EncodedFrame) async throws
}

import Foundation

/// Cabeçalho binário de 28 bytes antes de cada frame de vídeo. Big-endian.
/// Layout idêntico a core/Video/VideoPacketHeader.cs (ver docs/protocol.md, seção de vídeo).
struct VideoPacketHeader: Equatable {
    static let size = 28
    static let formatVersion: UInt8 = 1
    static let maxPayloadBytes = 8 * 1024 * 1024
    private static let magic: [UInt8] = [0x69, 0x43, 0x56, 0x46] // "iCVF"
    private static let keyframeFlag: UInt8 = 0x01

    let codec: VideoCodec
    let isKeyframe: Bool
    let width: UInt32
    let height: UInt32
    let presentationTimeUs: UInt64
    let payloadLength: UInt32

    /// Byte de codec no fio: 1 = H.264, 2 = HEVC.
    private var wireCodec: UInt8 {
        switch codec {
        case .h264: return 1
        case .hevc: return 2
        }
    }

    func encoded() throws -> Data {
        guard payloadLength > 0, Int(payloadLength) <= VideoPacketHeader.maxPayloadBytes else {
            throw ProtocolError.frameTooLarge(Int(payloadLength))
        }

        var bytes = [UInt8](repeating: 0, count: VideoPacketHeader.size)
        bytes[0...3] = VideoPacketHeader.magic[0...3]
        bytes[4] = VideoPacketHeader.formatVersion
        bytes[5] = wireCodec
        bytes[6] = isKeyframe ? VideoPacketHeader.keyframeFlag : 0
        bytes[7] = 0
        Self.writeBigEndian(UInt64(width), count: 4, into: &bytes, at: 8)
        Self.writeBigEndian(UInt64(height), count: 4, into: &bytes, at: 12)
        Self.writeBigEndian(presentationTimeUs, count: 8, into: &bytes, at: 16)
        Self.writeBigEndian(UInt64(payloadLength), count: 4, into: &bytes, at: 24)
        return Data(bytes)
    }

    static func parse(_ data: Data) throws -> VideoPacketHeader {
        guard data.count >= size else {
            throw ProtocolError.invalidJSON("cabeçalho de vídeo incompleto")
        }
        let bytes = [UInt8](data.prefix(size))

        guard Array(bytes[0...3]) == magic else {
            throw ProtocolError.invalidJSON("magic inválido no cabeçalho de vídeo")
        }
        guard bytes[4] == formatVersion else {
            throw ProtocolError.unsupportedVersion(Int(bytes[4]))
        }

        let codec: VideoCodec
        switch bytes[5] {
        case 1: codec = .h264
        case 2: codec = .hevc
        default: throw ProtocolError.invalidJSON("codec de vídeo desconhecido: \(bytes[5])")
        }

        let payloadLength = UInt32(readBigEndian(bytes, at: 24, count: 4))
        guard payloadLength > 0, Int(payloadLength) <= maxPayloadBytes else {
            throw ProtocolError.frameTooLarge(Int(payloadLength))
        }

        return VideoPacketHeader(
            codec: codec,
            isKeyframe: (bytes[6] & keyframeFlag) != 0,
            width: UInt32(readBigEndian(bytes, at: 8, count: 4)),
            height: UInt32(readBigEndian(bytes, at: 12, count: 4)),
            presentationTimeUs: readBigEndian(bytes, at: 16, count: 8),
            payloadLength: payloadLength
        )
    }

    private static func writeBigEndian(_ value: UInt64, count: Int, into bytes: inout [UInt8], at offset: Int) {
        for i in 0..<count {
            let shift = UInt64(8 * (count - 1 - i))
            bytes[offset + i] = UInt8((value >> shift) & 0xFF)
        }
    }

    private static func readBigEndian(_ bytes: [UInt8], at offset: Int, count: Int) -> UInt64 {
        var value: UInt64 = 0
        for i in 0..<count {
            value = (value << 8) | UInt64(bytes[offset + i])
        }
        return value
    }
}

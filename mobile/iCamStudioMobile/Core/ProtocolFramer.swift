import Foundation

/// Erros de formato no protocolo. Ao receber um, a conexão deve ser encerrada.
enum ProtocolError: Error, Equatable {
    case unsupportedVersion(Int)
    case missingType
    case frameSizeInvalid(UInt32)
    case frameTooLarge(Int)
    case invalidJSON(String)
    case encodingFailed(String)
}

/// Framing do canal de controle: [uint32 big-endian: tamanho][JSON UTF-8 do envelope].
/// Equivalente a core/Protocol/ProtocolCodec.cs.
enum ProtocolFramer {
    static let protocolVersion = 1
    static let lengthPrefixBytes = 4
    static let maxMessageBytes = 64 * 1024

    static func encode<Payload: Encodable>(
        type: String,
        payload: Payload,
        timestampMs: Int64,
        id: UUID = UUID()
    ) throws -> Data {
        let envelope = Envelope(v: protocolVersion, type: type, id: id, ts: timestampMs, payload: payload)

        let json: Data
        do {
            json = try JSONEncoder().encode(envelope)
        } catch {
            throw ProtocolError.encodingFailed(error.localizedDescription)
        }
        guard json.count <= maxMessageBytes else {
            throw ProtocolError.frameTooLarge(json.count)
        }

        var frame = withUnsafeBytes(of: UInt32(json.count).bigEndian) { Data($0) }
        frame.append(json)
        return frame
    }

    /// Decodifica o primeiro frame do buffer (que deve começar em uma fronteira de frame).
    /// Retorna nil se o frame ainda estiver incompleto. Lança ProtocolError se estiver malformado.
    static func decode<Payload: Decodable>(
        _ buffer: Data,
        payloadType: Payload.Type = Payload.self
    ) throws -> (envelope: Envelope<Payload>, consumed: Int)? {
        guard buffer.count >= lengthPrefixBytes else { return nil }

        let start = buffer.startIndex
        let b0 = UInt32(buffer[start]), b1 = UInt32(buffer[start + 1])
        let b2 = UInt32(buffer[start + 2]), b3 = UInt32(buffer[start + 3])
        let length = (b0 << 24) | (b1 << 16) | (b2 << 8) | b3

        guard length > 0, length <= UInt32(maxMessageBytes) else {
            throw ProtocolError.frameSizeInvalid(length)
        }

        let total = lengthPrefixBytes + Int(length)
        guard buffer.count >= total else { return nil }

        let body = buffer.subdata(in: (start + lengthPrefixBytes)..<(start + total))
        let decoder = JSONDecoder()

        let header: EnvelopeHeader
        do {
            header = try decoder.decode(EnvelopeHeader.self, from: body)
        } catch {
            throw ProtocolError.invalidJSON(error.localizedDescription)
        }

        guard header.v == protocolVersion else {
            throw ProtocolError.unsupportedVersion(header.v)
        }
        guard !header.type.trimmingCharacters(in: .whitespaces).isEmpty else {
            throw ProtocolError.missingType
        }

        do {
            let envelope = try decoder.decode(Envelope<Payload>.self, from: body)
            return (envelope, total)
        } catch {
            throw ProtocolError.invalidJSON(error.localizedDescription)
        }
    }
}

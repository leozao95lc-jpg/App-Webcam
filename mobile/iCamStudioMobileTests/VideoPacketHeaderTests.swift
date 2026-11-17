import XCTest
@testable import iCamStudioMobile

final class VideoPacketHeaderTests: XCTestCase {

    func testHeaderRoundtrip() throws {
        let header = VideoPacketHeader(
            codec: .hevc, isKeyframe: true, width: 3840, height: 2160,
            presentationTimeUs: 1_234_567_890, payloadLength: 512_000
        )
        let bytes = try header.encoded()

        XCTAssertEqual(bytes.count, VideoPacketHeader.size)
        XCTAssertEqual(try VideoPacketHeader.parse(bytes), header)
    }

    func testLayoutMatchesDesktopSpec() throws {
        let header = VideoPacketHeader(
            codec: .h264, isKeyframe: false, width: 3840, height: 2160,
            presentationTimeUs: 0x0102030405060708, payloadLength: 1000
        )
        let bytes = [UInt8](try header.encoded())

        XCTAssertEqual(Array(bytes[0...3]), [0x69, 0x43, 0x56, 0x46]) // "iCVF"
        XCTAssertEqual(bytes[4], 1)
        XCTAssertEqual(bytes[5], 1) // H.264
        XCTAssertEqual(bytes[6], 0)
        XCTAssertEqual(Array(bytes[8...11]), [0x00, 0x00, 0x0F, 0x00])
        XCTAssertEqual(Array(bytes[16...23]), [1, 2, 3, 4, 5, 6, 7, 8])
        XCTAssertEqual(Array(bytes[24...27]), [0x00, 0x00, 0x03, 0xE8])
    }

    func testBadMagicIsRejected() throws {
        var bytes = [UInt8](try VideoPacketHeader(codec: .h264, isKeyframe: false, width: 1, height: 1,
                                                  presentationTimeUs: 0, payloadLength: 1).encoded())
        bytes[0] = 0

        XCTAssertThrowsError(try VideoPacketHeader.parse(Data(bytes)))
    }

    func testZeroPayloadIsRejected() {
        let header = VideoPacketHeader(codec: .h264, isKeyframe: false, width: 1, height: 1,
                                       presentationTimeUs: 0, payloadLength: 0)
        XCTAssertThrowsError(try header.encoded())
    }
}

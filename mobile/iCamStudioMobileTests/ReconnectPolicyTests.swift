import XCTest
@testable import iCamStudioMobile

/// Mesmos valores de tests/core.Tests/ReconnectPolicyTests.cs.
final class ReconnectPolicyTests: XCTestCase {

    func testDefaultBackoffMatchesDesktop() {
        let policy = ReconnectPolicy.default
        XCTAssertEqual(policy.delay(forAttempt: 1), 0.5)
        XCTAssertEqual(policy.delay(forAttempt: 2), 1.0)
        XCTAssertEqual(policy.delay(forAttempt: 3), 2.0)
        XCTAssertEqual(policy.delay(forAttempt: 4), 4.0)
        XCTAssertEqual(policy.delay(forAttempt: 5), 8.0)
        XCTAssertEqual(policy.delay(forAttempt: 6), 10.0)
    }

    func testLimitedPolicyReturnsNilAfterMaxAttempts() {
        let policy = ReconnectPolicy(initialDelay: 0.1, multiplier: 2, maxDelay: 1, maxAttempts: 3)
        XCTAssertNotNil(policy.delay(forAttempt: 3))
        XCTAssertNil(policy.delay(forAttempt: 4))
    }
}

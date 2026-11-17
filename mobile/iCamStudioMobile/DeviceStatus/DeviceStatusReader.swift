import Foundation
import UIKit

/// Leitura real de temperatura (ProcessInfo.thermalState) e bateria (UIDevice).
/// Não há API pública para temperatura em °C: o produto mostra o estado térmico do iOS.
struct DeviceStatusSnapshot: Equatable {
    let thermal: ThermalLevel
    let batteryPercent: Int?
    let isCharging: Bool?
}

@MainActor
final class DeviceStatusReader {
    func snapshot() -> DeviceStatusSnapshot {
        let device = UIDevice.current
        device.isBatteryMonitoringEnabled = true

        let level = device.batteryLevel // -1 quando desconhecido (ex.: simulador)
        let percent: Int? = level < 0 ? nil : Int((level * 100).rounded())

        let charging: Bool?
        switch device.batteryState {
        case .charging, .full: charging = true
        case .unplugged: charging = false
        case .unknown: charging = nil
        @unknown default: charging = nil
        }

        return DeviceStatusSnapshot(
            thermal: ThermalLevel(processState: ProcessInfo.processInfo.thermalState),
            batteryPercent: percent,
            isCharging: charging
        )
    }
}

extension ThermalLevel {
    init(processState: ProcessInfo.ThermalState) {
        switch processState {
        case .nominal: self = .nominal
        case .fair: self = .fair
        case .serious: self = .serious
        case .critical: self = .critical
        @unknown default: self = .unknown
        }
    }
}

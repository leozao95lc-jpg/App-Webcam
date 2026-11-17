# Componentes: MOBILE (iOS)

App `mobile/iCamStudioMobile` (Swift 5.10, SwiftUI, iOS 17+). Gerado com XcodeGen a partir de `mobile/project.yml`.

**Atenção:** nenhum arquivo deste diretório foi compilado. O ambiente de desenvolvimento desta fase é Linux, sem Swift nem Xcode. Build e testes exigem macOS.

| Componente | Arquivo | Status (Fase 0) | Fase |
|---|---|---|---|
| CameraManager | `CameraManager/AVCameraManager.swift` (+ `CameraManaging.swift`) | **Implementado, não compilado** (Fase 1): lista lentes e formatos reais via AVCaptureDevice | 1 |
| CaptureEngine | `CaptureEngine/AVCaptureEngine.swift` (+ `CaptureEngining.swift`) | **Implementado, não compilado** (Fase 1): uma AVCaptureSession, escolhe formato que casa resolução + FPS, trava FPS | 1 |
| Encoder VideoToolbox | `VideoEncoder/VideoToolboxEncoder.swift` | **Implementado, não compilado** (Fase 1): H.264/HEVC, payload AVCC/HVCC com parâmetros em keyframes (protocol.md 5.3) | 1 |
| Preview local | `App/CameraPreviewView.swift` | **Implementado, não compilado**: AVCaptureVideoPreviewLayer na mesma sessão | 1 |
| Tela de captura | `App/CaptureViewModel.swift`, `App/ContentView.swift` | **Implementado, não compilado**: seleção só de opções que a lente suporta; valida com StreamConfigurationValidator antes de capturar | 1 |
| CameraConfiguration | `CameraConfiguration/StreamConfigurationValidator.swift` | **Implementado** (port do C#) | — |
| VideoEncoder | `VideoEncoder/VideoEncoding.swift` (`EncodedFrame`) | Protocolo + modelo | 1–2 |
| VideoTransport | `VideoTransport/VideoTransporting.swift` | Protocolo | 2 |
| RemoteControl | `RemoteControl/RemoteCommandHandling.swift`, `CameraCommandValidator.swift` | Protocolo + **validador implementado** | 2–3 |
| DeviceStatus | `DeviceStatus/DeviceStatusReader.swift` | **Implementado** (UIKit) | — |
| Protocolo | `Core/SharedModels.swift`, `ProtocolFramer.swift`, `VideoPacketHeader.swift` | **Implementado** | — |
| Reconexão | `Core/ReconnectPolicy.swift` | **Implementado** | — |
| Casca do app | `App/iCamStudioMobileApp.swift` | Entrada do app | — |

**Nota:** `DeviceStatusReader` (bateria e estado térmico) continua implementado, mas a tela da Fase 1 não o exibe ainda. Ligar na Fase 2, junto da telemetria enviada ao Desktop.

**Limitação de API (Fase 1):** `VTIsHardwareEncodeSupported` responde por codec, não por formato. O campo `hardwareEncodeSupported` é, portanto, igual para todos os formatos de um codec.

## Detalhes

**ProtocolFramer:** mesmo framing do Desktop. `decode` retorna `nil` se o frame estiver incompleto e lança `ProtocolError` se estiver malformado. Lê `EnvelopeHeader` antes do payload, para validar `v` e `type` sem decodificar o payload inteiro.

**VideoPacketHeader:** 28 bytes, big-endian, igual ao C#. Testado com bytes conhecidos.

**DeviceStatusReader:** `UIDevice.batteryLevel` (ativa `isBatteryMonitoringEnabled`) e `ProcessInfo.thermalState`. Não há temperatura em graus disponível para apps; o produto mostra o nível.

**Info.plist** (gerado por `project.yml`): `NSCameraUsageDescription`, `NSLocalNetworkUsageDescription`, `NSBonjourServices` com `_icamstudio._tcp`.

## Riscos específicos do iOS

- Captura para em segundo plano. O app precisa ficar em primeiro plano.
- `SWIFT_STRICT_CONCURRENCY: complete` está ativo. Pode gerar erros de concorrência no primeiro build; corrigir antes da Fase 1.
- O bundle id `dev.icamstudio.mobile` é placeholder. Trocar antes de assinar.
- Testes usam `#filePath` para localizar `tests/fixtures/protocol`. Se o projeto for movido, o caminho continua válido porque é relativo ao arquivo de teste.

## Como gerar e compilar (macOS)

Ver `mobile/README.md`.

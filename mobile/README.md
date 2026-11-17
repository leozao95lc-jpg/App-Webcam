# iCam Studio Mobile (iOS)

Aplicativo iOS em Swift e SwiftUI. Captura a câmera do iPhone e envia o vídeo ao Windows.

**Requisitos:** macOS, Xcode 16 ou superior, XcodeGen, iPhone com iOS 17 ou superior.

## Gerar o projeto

```bash
brew install xcodegen
cd mobile
xcodegen generate
open iCamStudioMobile.xcodeproj
```

O `.xcodeproj` é gerado e não é versionado. Edite `project.yml`, não o projeto gerado.

## Estrutura

```
iCamStudioMobile/
├── App/                 entrada do app e tela inicial
├── Core/                modelos do protocolo, framing, cabeçalho de vídeo, reconexão
├── CameraManager/       descoberta de câmeras (protocolo; Fase 1)
├── CaptureEngine/       sessão de captura (protocolo; Fase 1)
├── CameraConfiguration/ validação de configuração (implementado)
├── VideoEncoder/        codificação VideoToolbox (protocolo; Fase 1–2)
├── VideoTransport/      transporte de controle e vídeo (protocolo; Fase 2)
├── RemoteControl/       validação e aplicação de comandos
└── DeviceStatus/        bateria e estado térmico (implementado)
iCamStudioMobileTests/   XCTest: framing, cabeçalho, validação, reconexão
```

## Executar

1. Abra o projeto no Xcode.
2. Em *Signing & Capabilities*, escolha seu time de desenvolvedor.
3. Troque o bundle id de `dev.icamstudio.mobile` se ele estiver em uso.
4. Selecione o iPhone e pressione `Cmd+R`.

A permissão de câmera e a de rede local são pedidas no primeiro uso. Se você negar a rede local, a descoberta do computador vai falhar; reative em *Ajustes > Privacidade e Segurança > Rede Local*.

## Testes

```bash
xcodebuild test -project iCamStudioMobile.xcodeproj -scheme iCamStudioMobile \
  -destination 'platform=iOS Simulator,name=iPhone 17'
```

Os testes do protocolo leem as fixtures em `../tests/fixtures/protocol/`.

## Estado

Ainda não compilado. O código foi escrito em ambiente Linux, sem Xcode. O primeiro `xcodegen generate` e o primeiro build podem revelar erros de concorrência (`SWIFT_STRICT_CONCURRENCY: complete`). Registrar o resultado em `docs/validation-checklist.md`.

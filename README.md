# iCam Studio 4K

Transforma um iPhone em uma webcam 4K para Windows, com preview em tempo real, controles remotos da câmera e integração com o OBS Studio.

> **Status: Fase 0 (fundação).** Contratos, protocolo e casca dos aplicativos estão prontos. A captura, a transmissão e a câmera virtual **ainda não funcionam**. Ver [`docs/limitations.md`](docs/limitations.md).

## Estrutura

| Pasta | Conteúdo | Plataforma |
|---|---|---|
| [`core/`](core/) | Protocolo, modelos, validação, reconexão (.NET 10) | Windows e Linux |
| [`desktop/`](desktop/iCamStudio.Desktop/) | App WPF do Windows | Windows |
| [`mobile/`](mobile/) | App iOS (Swift/SwiftUI) | macOS + Xcode |
| [`obs/`](obs/) | Integração com OBS (estágio 1: câmera virtual) | Windows |
| [`tests/`](tests/) | Testes .NET e fixtures de protocolo compartilhadas | — |
| [`docs/`](docs/) | Arquitetura, protocolo, conexões, componentes, validação | — |

Documentação principal:
- [Arquitetura](docs/architecture.md)
- [Protocolo v1](docs/protocol.md)
- [Conexões Wi-Fi, WebRTC e USB](docs/connections.md)
- [Limitações conhecidas](docs/limitations.md)
- [Checklist de validação](docs/validation-checklist.md)
- Componentes: [core](docs/components/core.md) · [desktop](docs/components/desktop.md) · [mobile](docs/components/mobile.md) · [obs](docs/components/obs.md)

## Pré-requisitos

| Ferramenta | Versão | Para quê |
|---|---|---|
| .NET SDK | 10.0 | `core`, `desktop`, testes .NET |
| Windows 10 (19041) ou superior, com .NET 10 Desktop Runtime | — | executar o app Desktop |
| macOS com Xcode | 16 ou superior | build do iOS |
| XcodeGen | 2.40 ou superior | gerar o `.xcodeproj` a partir de `mobile/project.yml` |
| iPhone 17 (ou aparelho iOS 17+) | — | testes reais de câmera |

No Ubuntu/Debian (Linux, só para `core`): `sudo apt-get install -y dotnet-sdk-10.0`.

## Executar os testes do core (qualquer plataforma com .NET 10)

```bash
cd icam-studio-4k
dotnet test tests/core.Tests/iCamStudio.Core.Tests.csproj
```

Resultado esperado: `Passed! - Failed: 0, Passed: 66`.

## Compilar o Desktop (Windows, PowerShell)

```powershell
cd icam-studio-4k
dotnet build desktop\iCamStudio.Desktop\iCamStudio.Desktop.csproj -c Debug
dotnet run --project desktop\iCamStudio.Desktop\iCamStudio.Desktop.csproj
```

Testes do Desktop (Windows):

```powershell
dotnet test tests\desktop.Tests\iCamStudio.Desktop.Tests.csproj
```

Logs ficam em `%LOCALAPPDATA%\iCamStudio\logs\`. Configurações em `%LOCALAPPDATA%\iCamStudio\settings.json`.

## Compilar o iOS (macOS)

```bash
brew install xcodegen
cd icam-studio-4k/mobile
xcodegen generate
open iCamStudioMobile.xcodeproj
```

Antes de assinar no aparelho, troque `dev.icamstudio.mobile` em `mobile/project.yml` pelo seu bundle id.

Testes: `Cmd+U` no Xcode, ou:

```bash
xcodebuild test -project iCamStudioMobile.xcodeproj -scheme iCamStudioMobile \
  -destination 'platform=iOS Simulator,name=iPhone 17'
```

## O que ainda não está pronto

Pareamento, transmissão, decodificação, preview, câmera virtual e plugin do OBS. A lista completa, com riscos, está em [`docs/limitations.md`](docs/limitations.md). A ordem das fases está na especificação do projeto e no [checklist](docs/validation-checklist.md).

## Licença

Não definida. Antes de publicar, definir a licença — o plugin libobs, se existir, precisa ser compatível com a GPL-2.0 do OBS.

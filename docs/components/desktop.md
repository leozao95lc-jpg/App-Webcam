# Componentes: DESKTOP (Windows)

App `desktop/iCamStudio.Desktop` (WPF, MVVM com CommunityToolkit.Mvvm, .NET 10, `net10.0-windows10.0.19041.0`).

| Componente | Arquivo | Status (Fase 0) | Fase de implementação |
|---|---|---|---|
| DeviceDiscovery | `Discovery/IDeviceDiscovery.cs` | Interface | 2 |
| ConnectionManager | `Connection/IConnectionManager.cs` | Interface | 2 |
| VideoReceiver | `Video/IVideoReceiver.cs` | Interface | 3 |
| VideoDecoder | `Video/IVideoDecoder.cs`, `DecodedFrame.cs` | Interface + tipo de superfície | 3 |
| VideoPipeline | `Video/IVideoPipeline.cs` (`IFrameSink`) | Interface | 3 |
| PreviewRenderer | `Preview/IPreviewRenderer.cs` | Interface | 3 |
| VirtualCamera | `VirtualCamera/IVirtualCamera.cs` | Interface | 4 |
| CameraController | `Control/ICameraController.cs` | Interface | 2–3 |
| SettingsManager | `Settings/SettingsManager.cs` | **Implementado** | — |
| StructuredLogger | `Core/StructuredLogger.cs` | **Implementado** | — |
| AppPaths | `Core/AppPaths.cs` | **Implementado** | — |
| UI principal | `Views/MainWindow.xaml`, `ViewModels/MainViewModel.cs`, `Views/Themes/DarkTheme.xaml` | Casca visual; comandos desabilitados | 2–3 |

## Detalhes implementados

**SettingsManager** (`settings.json` em `%LOCALAPPDATA%\iCamStudio`)
- Padrões: 3840×2160, 30 FPS, HEVC, 35 000 kbps.
- Gravação atômica: escreve `settings.json.tmp` e depois move.
- Arquivo corrompido vai para `settings.json.corrupt`; o app segue com padrões.
- Valores fora da faixa são ajustados na leitura (bitrate e FPS).
- Não guarda chaves de pareamento. Elas irão para DPAPI na Fase 2.

**StructuredLogger** (JSON Lines em `%LOCALAPPDATA%\iCamStudio\logs\AAAA-MM-DD.jsonl`)
- Campos fixos: `ts` (UTC ISO 8601), `level`, `event`. Demais campos são livres.
- Nunca lança exceção. Falha de gravação vai para `Debug.WriteLine`.
- Não registra conteúdo de vídeo nem dados pessoais.

**MainViewModel**
- `ConnectionStatus` → texto em português.
- `StartStream` só habilita com status `Connected`; `StopStream` só com `Streaming`. Hoje nenhum dos dois ocorre, então ficam desabilitados.
- Telemetria mostra "—" até haver dados reais.

## Decisões pendentes que afetam este componente

- **Superfície decodificada (D7):** D3D11 texture (zero cópia, mas acopla ao renderer) ou NV12 em memória (mais simples, custa cópia). Decidir com medição na Fase 3.
- **Câmera virtual (Fase 4):** a abordagem precisa ser escolhida com um spike antes de implementar. Opções a avaliar:
  - *Media Foundation virtual camera* (API moderna; a verificar requisito de versão do Windows e de empacotamento).
  - *DirectShow virtual camera* (API legada; mais compatível com apps antigos, porém mais frágil).
  - Critério: o OBS lista e recebe frames da câmera sem driver de terceiros e sem assinatura especial.

## Dependências

| Pacote | Versão | Uso |
|---|---|---|
| CommunityToolkit.Mvvm | 8.4.0 | ObservableObject, RelayCommand |
| Projeto `core` | local | Contratos |

Testes: `tests/desktop.Tests` (xUnit 2.9.2). Executam só em Windows.

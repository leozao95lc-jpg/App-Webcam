# Limitações conhecidas — Fase 0

Estado honesto do que existe. Nenhum item abaixo está escondido.

## 0. Fase 1 — código escrito, não compilado nem executado

Os arquivos abaixo existem, mas **nunca foram compilados**: não há Xcode nem iPhone neste ambiente.
- `CameraManager/AVCameraManager.swift`, `CaptureEngine/AVCaptureEngine.swift`, `VideoEncoder/VideoToolboxEncoder.swift`, `App/CameraPreviewView.swift`, `App/CaptureViewModel.swift`, `App/ContentView.swift`.
- Símbolos de API que **não consegui confirmar** no SDK do iOS e precisam de checagem no primeiro build: `kVTCompressionPropertyKey_UsingHardwareAcceleratedVideoEncoder` (usado para saber se é hardware) e as funções `CMVideoFormatDescriptionGetHEVCParameterSetAtIndex` / `...H264...`.
- Critérios da Fase 1 (`validation-checklist.md`) continuam **não cumpridos**. Nada aqui prova que a captura funciona no aparelho.

## 1. Não implementado (esperado nesta fase)

- **Codificação**: código escrito (ver seção 0), não validado no aparelho.
- **Transmissão de vídeo ao Desktop**: sem socket ainda. A Fase 2 é que liga o encoder ao transporte.
- **Transporte real** (Wi-Fi, WebRTC, USB): só interface e modelo. Nenhum socket foi aberto.
- **Descoberta na rede** (`DeviceDiscovery`): só interface.
- **Pareamento**: só o formato das mensagens. Nenhuma criptografia implementada.
- **Decodificação e preview** (Media Foundation, D3D11): só interfaces.
- **Câmera virtual para o OBS**: só interface. Nenhuma estratégia validada.
- **Controle remoto de câmera** (zoom, foco, exposição): comandos validados em `core`; nenhum aplicado ao hardware.
- **Plugin libobs**: não iniciado.

## 2. Não verificado neste ambiente

- **Código Swift não foi compilado.** O container Linux não tem Swift nem Xcode. Os arquivos em `mobile/` foram escritos com cuidado mas precisam de `xcodegen generate` e build em macOS. Os testes Swift nunca rodaram.
- **Projeto WPF compila em Linux, mas não executa aqui.** `EnableWindowsTargeting` permite compilar; a execução exige Windows.
- **Testes do Desktop compilam, mas não rodam aqui.** O runner exige o runtime Windows Desktop. Só `core` foi executado: 66 testes passando.
- **Nenhum teste de rede real.** Não há aparelho nem Windows neste ambiente.

## 3. Limitações de plataforma (conhecidas, documentadas)

| Plataforma | Limitação | Impacto |
|---|---|---|
| iOS | Captura para quando o app vai ao segundo plano | O aparelho precisa ficar com o app aberto e a tela ligada |
| iOS | Permissão de rede local obrigatória | Primeiro uso mostra prompt; se negada, descoberta falha |
| iOS | Temperatura só como estado (`ProcessInfo.ThermalState`), sem °C | Indicador mostra nível, não temperatura numérica |
| iOS | Bateria pode retornar desconhecida (simulador) | Indicador mostra "—" |
| iOS | USB genérico não é disponível para apps de terceiros | USB depende de PoC (Fase 5) |
| Windows | Sem mDNS nativo no .NET | Descoberta precisa de implementação própria ou fallback por IP |
| Windows | Media Foundation e câmera virtual dependem da versão do Windows | Versão mínima a definir na Fase 4 |

## 4. Riscos técnicos abertos

1. **WebRTC no Windows** pode não ser viável no prazo; ver `connections.md`.
2. **Câmera virtual aceita pelo OBS** ainda não foi provada. Pode exigir assinatura de driver em alguns cenários. Validar cedo (Fase 4), não no fim.
3. **4K60 H.264/HEVC** pode não ser sustentável em hardware nem em térmica. Só medir na Fase 6.
4. **Bitrate 2–80 Mbps** é referência, não medida.
5. **Porta 47800** é provisória.
6. **Pareamento sem TLS** é lacuna até a decisão da Fase 2 (`protocol.md`, seção 6).

## 5. Limitações do próprio código

- `DecodedFrame.Surface` é `IDisposable` sem tipo real: o formato final depende da Fase 3.
- `IVideoTransport` expõe `ProtocolEnvelope` já deserializado; se o custo de JSON por mensagem importar, mudar para bytes na Fase 2.
- `FpsMeter` não é thread-safe por design; deve ser usado por um único pipeline.
- `MainViewModel` tem comandos que não fazem nada quando habilitados. Hoje nunca são habilitados (dependem de `Connected`), mas quando a Fase 2 chegar, o corpo precisa ser preenchido antes de habilitar.

# Checklist de validação

Marque cada item só depois de executar e observar o resultado. Itens marcados como **[ambiente]** exigem o ambiente indicado.

## Fase 0 — Fundação

### Estrutura e build
- [x] Repositório com `core/`, `desktop/`, `mobile/`, `obs/`, `tests/`, `docs/`, `README.md`.
- [x] Solution `icam-studio-4k.slnx` contém os 4 projetos .NET.
- [x] `core` compila sem warnings (`TreatWarningsAsErrors`). *Verificado em Linux, .NET 10.0.115.*
- [x] `desktop` compila com XAML. *Verificado em Linux via `EnableWindowsTargeting`.*
- [ ] `desktop` executa a janela principal. **[ambiente: Windows 10/11 com .NET 10 Desktop Runtime]**
- [ ] `mobile` gera `.xcodeproj` com `xcodegen generate`. **[ambiente: macOS + Xcode 16+]**
- [ ] `mobile` compila para iOS 17+. **[ambiente: macOS + Xcode]**

### Testes
- [x] `core` — 66 testes passando. *Verificado em Linux.*
- [ ] `desktop` — testes de `SettingsManager` e `StructuredLogger` executam. **[ambiente: Windows]**
- [ ] `mobile` — `XCTest` executa `ProtocolFramerTests`, `VideoPacketHeaderTests`, `StreamConfigurationValidatorTests`, `ReconnectPolicyTests`. **[ambiente: macOS]**

### Contrato
- [x] Fixtures em `tests/fixtures/protocol/` são lidas pelo teste de contrato em C#.
- [ ] Fixtures são lidas pelos testes Swift. **[ambiente: macOS]** *(o caminho é relativo a `#filePath`; confirmar no primeiro build)*
- [x] Enums no fio são camelCase nos dois lados (verificado por leitura; confirmar por teste Swift).

## Fase 1 — Captura iOS (critérios de conclusão)
- [ ] Lista de câmeras reais do aparelho, com formatos individuais por lente. **[ambiente: iPhone 17]**
- [ ] Seleção de câmera troca a lente sem reiniciar o app.
- [ ] Aplicação de resolução e FPS validada contra `StreamConfigurationValidator` antes de chamar `AVCaptureDevice`.
- [ ] Preview local estável em 4K30 por 10 minutos.
- [ ] Codificação H.264 e HEVC por hardware confirmada (log do VideoToolbox mostra `UsingHardwareAcceleratedVideoEncoder`).
- [ ] Formato do payload (Annex B ou AVCC/HVCC) fixado e registrado em `protocol.md`.

## Fase 2 — Transmissão
- [ ] Descoberta por DNS-SD ou por IP manual encontra o iPhone na mesma rede. **[ambiente: Windows + iPhone + Wi-Fi]**
- [ ] Pareamento com código de 6 dígitos concluído nos dois lados.
- [ ] Reconexão automática recupera o stream após desligar o Wi-Fi por 10 s.
- [ ] Reconexão após o iPhone bloquear a tela e voltar ao app.
- [ ] Latência medida e registrada (captura → preview).
- [ ] Teste de 30 minutos sem queda de sessão.

## Fase 3 — Desktop
- [ ] Preview recebe frames e mostra FPS real (não o nominal).
- [ ] Decodificação por hardware confirmada (log mostra `IsHardwareAccelerated = true`).
- [ ] Zoom, foco e exposição alteram a imagem no iPhone.

## Fase 4 — OBS
- [ ] "iCam Studio 4K" aparece na lista de fontes do OBS.
- [ ] OBS e preview consomem o mesmo fluxo (uma única sessão no iPhone, confirmada por log).
- [ ] Desligar o OBS não afeta o preview e vice-versa.

## Fase 5 — USB
- [ ] Conexão TCP estável via cabo por 30 minutos.
- [ ] Latência comparada com Wi-Fi em tabela.
- [ ] Decisão registrada: mantém, ou descarta com motivo.

## Fase 6 — Otimização
- [ ] 4K30 sustentado por 60 minutos com temperatura abaixo de `serious`.
- [ ] 4K60: testado ou registrado como não suportado neste aparelho.
- [ ] Uso de CPU e memória do Desktop medido em sessão longa.
- [ ] Vazamento de memória verificado (memória estável após 60 minutos).

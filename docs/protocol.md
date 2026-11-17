# Protocolo iCam Studio — v1

Status: **especificação da Fase 0**. Os tipos estão implementados em C# (`core/`) e espelhados em Swift (`mobile/iCamStudioMobile/Core/`). As fixtures em `tests/fixtures/protocol/` são a fonte única de exemplos e são lidas pelos testes dos dois lados.

## 1. Canais

| Canal | Conteúdo | Formato | Estado |
|---|---|---|---|
| Controle | handshake, pareamento, configuração, comandos, telemetria, erros | JSON com prefixo de tamanho (seção 2) | Contrato definido; TCP a validar na Fase 2 |
| Vídeo | frames H.264/HEVC codificados | Cabeçalho binário de 28 bytes + payload (seção 5) | Contrato definido; transporte a decidir (ver `connections.md`) |

Os dois canais são lógicos. Um `IVideoTransport` pode multiplexá-los na mesma conexão ou usar conexões separadas.

## 2. Enquadramento (canal de controle)

```
+----------------------+----------------------------------+
| uint32 big-endian    | JSON UTF-8 do envelope           |
| tamanho do JSON (N)  | N bytes                          |
+----------------------+----------------------------------+
```

- Tamanho máximo do JSON: **64 KiB**. Acima disso: `frame_too_large` e fechar a conexão.
- Tamanho declarado igual a 0 ou acima do limite: `frame_size_invalid`, sem esperar o corpo.
- Leitura incompleta não consome bytes; o receptor aguarda mais dados.
- Dados malformados (JSON inválido, versão desconhecida, `type` vazio) encerram a conexão.

## 3. Envelope

```json
{
  "v": 1,
  "type": "command",
  "id": "6f1c2b9e-1111-4a2b-9c3d-000000000005",
  "ts": 1763380000300,
  "payload": { "command": { "kind": "setZoom", "value": 2.0 } }
}
```

| Campo | Tipo | Regra |
|---|---|---|
| `v` | int | Deve ser `1`. Qualquer outro valor é rejeitado. |
| `type` | string | Um dos valores da seção 4. |
| `id` | GUID | Único por mensagem. Usado para correlacionar `error` e respostas. |
| `ts` | int64 | Milissegundos Unix do emissor. Não é usado para sincronismo de vídeo (ver seção 5). |
| `payload` | objeto | Depende de `type`. |

**Convenções:** nomes de campo em camelCase; enums como strings camelCase (`"hevc"`, `"setZoom"`, `"nominal"`).

## 4. Mensagens

| `type` | Direção | Payload | Função |
|---|---|---|---|
| `hello` | iPhone → Desktop | `device`, `supportedVersions` | Identifica o aparelho e as versões que ele fala |
| `hello_ack` | Desktop → iPhone | `accepted`, `selectedVersion`, `sessionId`, `rejectReason` | Aceita ou rejeita a sessão |
| `pair_request` | Desktop → iPhone | `desktopPublicKey` | Inicia pareamento |
| `pair_response` | iPhone → Desktop | `mobilePublicKey`, `accepted` | Resposta do pareamento |
| `pair_confirm` | ambos | `confirmed` | Usuário confirmou o código de verificação |
| `capabilities` | iPhone → Desktop | `cameras[]` | Câmeras e formatos reais |
| `stream_configure` | Desktop → iPhone | `configuration` | Configuração a aplicar |
| `stream_state` | Desktop → iPhone | `streaming` | Liga ou desliga o envio de vídeo |
| `command` | Desktop → iPhone | `command` | Controle de câmera |
| `telemetry` | iPhone → Desktop | `snapshot` | Métricas a cada ~1 s |
| `error` | ambos | `code`, `message`, `retryable` | Falha reportada |
| `ping` / `pong` | ambos | `{}` | Liveness e medição de latência |

### 4.1 Objetos principais

**DeviceInformation**: `deviceId`, `name`, `model`, `osVersion`, `appVersion`.

**CameraCapability**: `cameraId`, `displayName`, `position` (`back`/`front`/`external`/`unknown`), `maxZoomFactor`, `formats[]`.

**CameraFormat**: `width`, `height`, `minFps`, `maxFps`, `codecs[]` (`h264`/`hevc`), `hardwareEncodeSupported`.

Cada câmera publica **seus próprios formatos**. Nunca presumir que todas as lentes suportam 4K ou 60 FPS.

**StreamConfiguration**: `cameraId`, `width`, `height`, `fps`, `codec`, `bitrateKbps`.

Regras de validação (aplicadas no Desktop antes do envio e no iPhone antes de aplicar):
- `cameraId` existe em `capabilities`.
- Existe um formato com exatamente `width`×`height` **e** que aceite `fps` **e** `codec` no mesmo formato.
- `fps` finito e positivo; `bitrateKbps` entre 2 000 e 80 000 (valores de referência; calibrar na Fase 6).
- Software encoding gera *warning*, não erro.

**CameraCommand**: `kind` + `value` opcional.

| `kind` | `value` | Faixa |
|---|---|---|
| `setZoom` | obrigatório | 1,0 até `maxZoomFactor` da lente |
| `setFocusLensPosition` | obrigatório | 0,0 a 1,0 |
| `setFocusAuto` | proibido | — |
| `setExposureBias` | obrigatório | −8 a +8 EV |
| `setExposureAuto` | proibido | — |

**TelemetrySnapshot**: `timestampMs`, `fps`, `bitrateKbps`, `encodeLatencyMs`, `thermal` (`nominal`/`fair`/`serious`/`critical`/`unknown`), `batteryPercent` (opcional), `isCharging` (opcional).

### 4.2 Sequência de sessão

```
iPhone                                   Desktop
  |---- hello (device, versões) --------->|
  |<---- hello_ack (aceito, sessionId) ---|   rejeitado => error + fechar
  |                                        |
  |<---- pair_request (chave pública) ----|   apenas se não houver pareamento salvo
  |---- pair_response (chave, aceito) --->|
  |<---> pair_confirm (usuário confirmou código) |
  |---- capabilities -------------------->|
  |<---- stream_configure ----------------|
  |<---- stream_state (true) -------------|
  |  ... vídeo + telemetry a cada 1 s ... |
  |<---- command (a qualquer momento) ----|
  |<---- ping / ---- pong ----------------|
```

Reconexão: após queda, o Desktop repete o `hello` seguindo `ReconnectPolicy` (0,5 s, 1 s, 2 s, 4 s, 8 s, depois 10 s em intervalo fixo, sem limite de tentativas). O iPhone reenvia `capabilities` e aguarda nova `stream_configure`.

## 5. Vídeo

### 5.1 Cabeçalho (28 bytes, big-endian)

| Offset | Tamanho | Campo | Valor |
|---|---|---|---|
| 0 | 4 | magic | `0x69 0x43 0x56 0x46` ("iCVF") |
| 4 | 1 | versão de formato | `1` |
| 5 | 1 | codec | `1` = H.264, `2` = HEVC |
| 6 | 1 | flags | bit 0 = keyframe |
| 7 | 1 | reservado | `0` |
| 8 | 4 | largura | u32 |
| 12 | 4 | altura | u32 |
| 16 | 8 | PTS | u64, microssegundos |
| 24 | 4 | tamanho do payload | u32, 1 até 8 MiB |

O payload é a unidade de acesso codificada (um frame). Para H.264/HEVC, o formato do payload (Annex B ou AVCC/HVCC) será fixado na Fase 1 e documentado aqui antes de ser usado.

### 5.3 Formato do payload (decidido na Fase 1)

- O payload é uma **sequência de NAL units com prefixo de tamanho de 4 bytes big-endian** (formato AVCC para H.264, HVCC para HEVC), que é o que o VideoToolbox entrega.
- Em **todo keyframe**, os conjuntos de parâmetros vêm **dentro do payload**, antes da imagem: SPS e PPS para H.264; VPS, SPS e PPS para HEVC. Assim o receptor não depende de nenhuma mensagem fora de banda para começar a decodificar ou se recuperar de perda.
- Não usamos Annex B (start codes) no fio. O Windows converte para o formato que o decodificador escolhido exigir.
- **Não verificado:** se o decodificador Media Foundation aceita este formato diretamente ou exige conversão. Validar no primeiro spike da Fase 3. Se exigir conversão, a conversão fica no Desktop e o protocolo não muda.

### 5.2 Sincronismo

- PTS vem do relógio do iPhone, em µs, e é preservado até o Desktop sem reescrita.
- O Desktop não usa `ts` do envelope para sincronizar vídeo.
- Medição de latência ponta a ponta: a comparar com `ping`/`pong` na Fase 2.

## 6. Pareamento e segurança (proposta, não implementada)

Objetivo: impedir que outro computador ou outro aparelho na mesma rede controle a câmera.

Proposta a validar na Fase 2:
1. Troca de chaves efêmeras por ECDH. Curva a confirmar: X25519 existe no CryptoKit; no .NET é preciso confirmar o suporte.
2. Ambos derivam um código de 6 dígitos a partir do segredo compartilhado (HKDF). O usuário compara os dois números na tela e confirma em `pair_confirm`.
3. O segredo de longo prazo é salvo nos dois lados. Reconexões usam desafio/resposta com HMAC, sem repetir o código.
4. Chaves não vão para `settings.json` em texto puro. No Windows, usar DPAPI; no iOS, o Keychain.

Riscos: sem TLS, o canal de controle fica sem confidencialidade. A proposta acima cobre autenticação e integridade do pareamento, mas o tráfego de vídeo pode ser lido por quem estiver na mesma rede. Decidir na Fase 2 se o canal será TLS (com certificado fixado pelo pareamento) ou cifrado na camada de aplicação.

## 7. Erros

| `code` | Quando | `retryable` |
|---|---|---|
| `unsupported_version` | `v` diferente de 1 | não |
| `invalid_json` / `invalid_payload` | corpo malformado | não |
| `frame_too_large` / `frame_size_invalid` | limite de framing | não |
| `invalid_configuration` | `stream_configure` rejeitado pelas capacidades | não |
| `camera_interrupted` | sistema iOS interrompeu a captura | sim |
| `thermal_limit` | estado térmico `critical` | sim, após resfriamento |
| `pairing_rejected` | usuário recusou | não |

Códigos são estáveis; mensagens são para exibição e podem mudar.

## 8. Versionamento

- Mudança que quebra compatibilidade incrementa `v`.
- Mudança compatível (campo novo opcional) não incrementa `v`; receptor ignora campos desconhecidos.
- O `hello` lista todas as versões suportadas; o `hello_ack` escolhe uma.
- Esta versão do protocolo é **1**.

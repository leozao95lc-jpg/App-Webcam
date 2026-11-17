# Conexões: Wi-Fi, WebRTC e USB

Este documento separa **o que está decidido**, **o que é proposta** e **o que é risco não validado**. Não trate a parte de USB como garantida.

## 1. Wi-Fi (rota principal)

### Descoberta
- DNS-SD / Bonjour, tipo `_icamstudio._tcp` (`ProtocolConstants.ServiceType`).
- iOS exige `NSLocalNetworkUsageDescription` e a chave `NSBonjourServices` no Info.plist (já configuradas em `mobile/project.yml`).
- **Risco:** o Windows não tem API gerenciada de mDNS embutida no .NET. Opções: (a) cliente DNS-SD próprio sobre UDP multicast, (b) depender do serviço Bonjour instalado, (c) entrada manual de IP como fallback. Decidir na Fase 2. Recomendação: (a) com (c) como fallback obrigatório, porque descoberta falha em redes com isolamento de clientes.

### Transporte de vídeo: a tensão no requisito

O requisito pede **WebRTC**. Ele é a escolha certa para tolerância a perda e adaptação de bitrate, mas tem custos concretos neste produto:

| Ponto | WebRTC (libwebrtc) | TCP/UDP próprio com H.264/HEVC |
|---|---|---|
| Binding no Windows | Não há binding .NET maduro conhecido; exige ponte C/C++ (libwebrtc) empacotada | Sem dependência nativa além do que já usamos |
| Hardware no iOS | Por padrão, o WebRTC codifica e decodifica por seus próprios caminhos; usar VideoToolbox exige encoder customizado | O encoder VideoToolbox entrega o NAL diretamente |
| Latência | Boa, com jitter buffer controlado | Depende de implementação; TCP sofre head-of-line blocking |
| Adaptação de bitrate | Nativa (GCC) | Precisa ser implementada |
| Complexidade de sinalização | Alta (SDP/ICE/STUN) mesmo em LAN | Baixa |

**Recomendação:** manter WebRTC como alvo (`TransportKind.WifiWebRtc`) e começar a Fase 2 com um transporte mais simples sob `IVideoTransport` (`TransportKind.WifiTcp`), usando o cabeçalho de 28 bytes da seção 5 de `protocol.md`. Isso permite validar pipeline, latência e tratamento de erro antes de pagar o custo de WebRTC. **Decisão sua:** aceitar essa troca de ordem ou exigir WebRTC desde o primeiro transporte.

Spike de WebRTC (se for mantido como alvo): antes da Fase 2, medir se a ponte nativa compila e entrega frames H.264 no Windows com latência aceitável. Critério de saída: latência de captura a preview abaixo de um valor a definir com você (sugestão inicial: 150 ms em 4K30 na mesma LAN).

### Controle remoto e reconexão
- Canal de controle independente do vídeo na implementação TCP.
- Reconexão por `ReconnectPolicy` (`core/Resilience`).
- **Limitação do iOS:** a captura da câmera para quando o app vai para o segundo plano. O produto só funciona com o app em primeiro plano; o iOS não permite contornar isso para apps de terceiros.

## 2. USB

**Estado: investigação. Nenhum código de transporte USB existe nesta fase.**

- iOS não expõe uma interface USB genérica para apps de terceiros. O caminho conhecido é o túnel usbmuxd, usado por ferramentas como libimobiledevice, que encaminha uma porta TCP do aparelho para o computador.
- No Windows, o serviço que intermedia isso faz parte do Apple Mobile Device Support (instalado com iTunes/Apple Devices). A integração exige um cliente que fale com esse serviço.
- **Não presumir** que isso funcione para um app de produção sem validação em aparelho real. A validação é o objeto da Fase 5.

Critérios da prova de conceito (Fase 5):
1. Conectar ao iPhone 17 via cabo e obter uma conexão TCP estável ao app.
2. Transferir o mesmo fluxo de controle e de vídeo do Wi-Fi.
3. Medir latência e estabilidade por 30 minutos e comparar com Wi-Fi.
4. Documentar o que quebra (desconexão ao bloquear o aparelho, dependência de software instalado, etc.).

Se a PoC falhar, USB é descartado e a documentação registra o motivo. Nada na Fase 2 depende dele.

## 3. Interface comum

Wi-Fi e USB implementam `IVideoTransport` (`core/Transport/IVideoTransport.cs`). O restante do sistema usa somente a interface. Trocar o meio = nova implementação + `TransportKind` novo, sem mudar `ConnectionManager`, `VideoPipeline`, `CameraController` ou a UI.

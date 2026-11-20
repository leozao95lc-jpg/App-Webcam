# Pesquisa: conexão USB

Estado: **pesquisa inicial, sem prova de conceito**. Nenhum código de transporte USB existe. A prioridade é Wi-Fi.

## Premissas que precisam ser verificadas

1. **Safari não acessa dispositivos USB.** A Web USB API não está disponível no Safari para iOS. Portanto o PWA não pode falar USB diretamente com o iPhone. Confirmar na versão do Safari da época do teste.
2. **O cabo não cria um canal de aplicativo.** Não existe, para apps de terceiros, uma conexão de dados entre o PWA e o computador pelo cabo.
3. **O caminho plausível é a rede pelo cabo (USB tethering / "Compartilhamento de Internet").** Quando o iPhone compartilha a conexão pelo cabo, o Windows recebe uma interface de rede com IP. Se o iPhone e o PC trocam pacotes por essa interface, o PWA alcança o servidor pelo IP dessa interface, sem Wi-Fi.

## O que testar (Fase 5)

| # | Teste | Como | Critério |
|---|---|---|---|
| 1 | Interface de rede criada | Conectar o cabo com "Compartilhamento pessoal" ativo | Windows lista interface nova com IPv4 |
| 2 | Alcance do servidor | Servidor ouvindo em `0.0.0.0:8443`; abrir o IP da interface no Safari | PWA carrega |
| 3 | Estabilidade | Transmissão de controle por 30 min | sem queda |
| 4 | Latência | Comparar `ping`/`pong` com Wi-Fi | tabela registrada |
| 5 | Comportamento com tela bloqueada | Bloquear o iPhone durante a sessão | documentar |

## Riscos

- Compartilhamento pessoal pode exigir configurações específicas no iPhone e drivers do Windows (Apple Mobile Device Support). Confirmar no próprio aparelho.
- O Windows pode classificar a interface como rede pública, bloqueando o servidor pelo firewall. Teste de firewall faz parte da Fase 5.
- Dependência de configuração manual no iPhone é uma fricção para o produto. Só vale se a latência ou a estabilidade compensarem.

## Critério de descarte

Se o alcance (teste 2) falhar, ou a estabilidade (teste 3) não sustentar a sessão, USB é descartado com o motivo registrado aqui. Nada na Fase 2 depende de USB.

## Interface comum

Quando a PoC existir, ela implementa a mesma interface de transporte que o Wi-Fi. Hoje não há interface formal de transporte no PWA; a Fase 2 introduz `ITransport` com `WiFiTransport` e `USBNetworkTransport`.

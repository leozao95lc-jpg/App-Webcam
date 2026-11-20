# Segurança

Escopo atual: pareamento e transporte de controle na rede local. Transmissão de vídeo (WebRTC) entra na Fase 2 e terá seu próprio item aqui.

## Superfícies

| Superfície | Porta (padrão) | Quem usa | O que expõe |
|---|---|---|---|
| API local | `127.0.0.1:8080` (HTTP) | app Desktop | criar sessão, consultar status |
| Público | `0.0.0.0:8443` (HTTPS) | iPhone na rede | PWA, `icam-ca.crt`, `POST /api/pair`, `GET /api/health` |

A separação é por **socket**: a API local só escuta em loopback. Mesmo que o firewall libere a porta 8080, ela não é alcançável pela rede. A superfície pública nunca cria sessões (testado em `httpapi/server_test.go`).

## Pareamento

1. O Desktop cria uma sessão: `sessionId` de 128 bits e código numérico de 6 dígitos (uniforme, sem viés de módulo).
2. Só existe **uma sessão aguardando** por vez. Criar outra descarta a anterior.
3. O QR code aponta para `https://<IP>:8443/#pair=<sessionId>.<código>`. O código fica no **fragmento** da URL, que o navegador não envia ao servidor, então não entra em logs de acesso.
4. Cinco tentativas erradas bloqueiam a sessão. A resposta informa `attemptsLeft`.
5. Código correto: uso único. Emite um token de 256 bits, guardado só como SHA-256 em memória.
6. Sessão expira em 5 minutos sem pareamento. Token expira em 12 horas.
7. Comparações de código e token usam `subtle.ConstantTimeCompare`.

**Limitação conhecida:** não há limite de tentativas por IP. Com 5 tentativas por sessão e 1 milhão de códigos, a chance de acerto por tentativa é de 5 em um milhão. Isso é aceitável para uso pessoal em rede doméstica, não para rede pública.

## HTTPS e a CA local

O Safari só libera a câmera em contexto seguro. Um certificado autoassinado geraria alerta a cada acesso. Por isso o `gencert` cria uma **CA local** e um certificado de servidor assinado por ela.

Instalação no iPhone (uma vez):

1. No Safari, abra `https://<IP-do-PC>:8443/icam-ca.crt`. Confirme o alerta de certificado, se aparecer.
2. Ajustes > "Perfil transferido" > Instalar.
3. Ajustes > Geral > Sobre > **Ajustes de Confiança de Certificado** > ative a confiança total para "iCam Studio 4K (local)".

Sem o passo 3, o perfil existe mas não é confiável. Com isso, o Safari não registra o service worker e não instala o PWA completo.

**Não verificado:** os passos acima seguem a documentação geral da Apple para perfis de CA. Não testamos em iPhone 17 real ainda. Registrar o resultado na checklist de validação.

Chave privada: `certs/*.key` fica no disco com permissão restrita (0600 no Linux; no Windows, herda as ACLs da pasta). Nunca versionar. Está no `.gitignore`.

## Cabeçalhos HTTP

Todas as respostas: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(self)`. Respostas da API: `Cache-Control: no-store`. `index.html` e `sw.js`: `no-cache`, para que atualizações do PWA cheguem ao iPhone.

## Desktop (Electron)

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- A página só acessa `window.icam`, uma lista fechada de métodos. Não há `ipcRenderer` exposto. O teste `electron-smoke.mjs` verifica que `require`, `process` e `ipcRenderer` não existem na página.
- Navegação para fora do app é bloqueada; links abrem no navegador do sistema.
- A página do Desktop tem CSP restrita (`connect-src 'none'`): a interface não faz chamadas de rede. Quem fala com o servidor é o processo principal.

## O que não está coberto ainda

- Rate limit por IP no pareamento.
- Revogação de token pela interface (hoje o token expira sozinho).
- Cifragem do canal de vídeo (depende da decisão WebRTC/DTLS da Fase 2).
- Armazenamento seguro do token no iPhone (hoje só em memória; Fase 2).
- Auditoria: logs estruturados existem (`slog`, JSON), mas ainda não registram eventos de pareamento. Adicionar na Fase 2.

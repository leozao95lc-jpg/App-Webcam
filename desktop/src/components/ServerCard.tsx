/** Instruções para ligar o servidor quando ele estiver desligado. Nada é simulado. */
export function ServerCard({ online }: { online: boolean | null }) {
  return (
    <section className="card">
      <h2>Servidor de sinalização</h2>
      {online === false && (
        <div className="banner err">
          O servidor não está rodando. Abra um terminal na pasta <code>signaling-server</code> e execute:
          <pre className="code">{`.\\bin\\icam-signaling.exe -static-dir ..\\apps\\mobile-pwa\\dist -certs .\\certs`}</pre>
          Ainda não existe certificado? Antes, rode <code>.\bin\gencert.exe -certs .\certs</code>.
        </div>
      )}
      {online === true && (
        <p className="muted">Servidor respondendo na porta local configurada. O iPhone usa a porta HTTPS da rede.</p>
      )}
      {online === null && <p className="muted">Verificando…</p>}
    </section>
  );
}

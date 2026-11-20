import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { PairingState } from '@icam/shared-types';

interface Session {
  sessionId: string;
  pairingCode: string;
  expiresAt: string;
  pairUrl: string;
}

const STATE_TEXT: Record<PairingState, { text: string; cls: string }> = {
  waiting: { text: 'Aguardando o iPhone…', cls: '' },
  paired: { text: 'iPhone pareado', cls: 'ok' },
  expired: { text: 'Código expirado. Gere outro.', cls: 'warn' },
  locked: { text: 'Bloqueado por tentativas erradas. Gere outro código.', cls: 'err' },
};

/** Cria uma sessão, mostra QR + código e acompanha o estado até parear, expirar ou bloquear. */
export function PairingCard({ enabled }: { enabled: boolean }) {
  const [session, setSession] = useState<Session | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [state, setState] = useState<PairingState>('waiting');
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  // Gera o QR só quando há URL de pareamento (precisa do IPv4 da LAN).
  useEffect(() => {
    if (!session?.pairUrl) {
      setQr(null);
      return;
    }
    void QRCode.toDataURL(session.pairUrl, { margin: 1, width: 240, color: { dark: '#0b0e13', light: '#ffffff' } }).then(setQr);
  }, [session]);

  // Relógio para a contagem regressiva.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Acompanha o estado da sessão até um estado final.
  useEffect(() => {
    if (!session) return;
    let alive = true;
    const id = window.setInterval(async () => {
      try {
        const s = await window.icam.sessionStatus(session.sessionId);
        if (!alive) return;
        setState(s.state);
        setAttemptsLeft(s.attemptsLeft);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'falha ao consultar o servidor');
      }
    }, 1500);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [session]);

  async function create() {
    setError(null);
    setState('waiting');
    setAttemptsLeft(null);
    try {
      setSession(await window.icam.createSession());
    } catch (err) {
      setSession(null);
      setError(err instanceof Error ? err.message : 'não foi possível criar a sessão');
    }
  }

  const remainingSec = session ? Math.max(0, Math.floor((Date.parse(session.expiresAt) - now) / 1000)) : 0;
  const finished = state === 'paired' || state === 'expired' || state === 'locked';
  const minutes = Math.floor(remainingSec / 60);
  const seconds = String(remainingSec % 60).padStart(2, '0');

  return (
    <section className="card wide">
      <h2>Pareamento com o iPhone</h2>
      <div className="pair-layout">
        <div className="pair-qr">
          {qr ? <img src={qr} alt="QR code para parear o iPhone" width={240} height={240} /> : <div className="qr-placeholder">QR code</div>}
        </div>
        <div className="pair-info">
          <button className="btn primary" onClick={create} disabled={!enabled}>
            {session ? 'Gerar novo código' : 'Criar sessão de pareamento'}
          </button>
          {!enabled && <p className="muted">Ligue o servidor para criar sessões.</p>}

          {session && (
            <>
              <div className="code-big" aria-label="Código de pareamento">
                {session.pairingCode.slice(0, 3)} {session.pairingCode.slice(3)}
              </div>
              <div className={`banner ${STATE_TEXT[state].cls}`}>{STATE_TEXT[state].text}</div>
              {!finished && (
                <p className="muted">
                  Expira em {minutes}:{seconds}
                  {attemptsLeft !== null && ` · tentativas restantes: ${attemptsLeft}`}
                </p>
              )}
              {!session.pairUrl && (
                <div className="banner warn">
                  Nenhum IPv4 de rede local encontrado. Escolha o endereço em Configurações.
                </div>
              )}
              {session.pairUrl && <p className="muted small">Endereço: <code>{session.pairUrl.split('#')[0]}</code></p>}
            </>
          )}
          {error && <div className="banner err">{error}</div>}
        </div>
      </div>
    </section>
  );
}

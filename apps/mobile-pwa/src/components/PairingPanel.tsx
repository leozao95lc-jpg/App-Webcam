import { useState } from 'react';
import { ApiRequestError, pairWithComputer, parsePairFragment } from '../services/signalingApi';

/**
 * Pareamento com o computador. O código pode vir do QR (fragmento #pair=...) ou ser digitado.
 * O token fica só em memória nesta fase: não é gravado no navegador.
 */
export function PairingPanel() {
  const fromHash = parsePairFragment(location.hash);
  const [sessionId, setSessionId] = useState(fromHash?.sessionId ?? '');
  const [code, setCode] = useState(fromHash?.code ?? '');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [token, setToken] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setResult(null);
    try {
      const res = await pairWithComputer(sessionId.trim().toLowerCase(), code.trim());
      setToken(res.token);
      setResult({ kind: 'ok', text: `Pareado. Válido até ${new Date(res.tokenExpiresAt).toLocaleString('pt-BR')}.` });
      history.replaceState(null, '', location.pathname);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        const left = err.attemptsLeft !== undefined ? ` Tentativas restantes: ${err.attemptsLeft}.` : '';
        setResult({ kind: 'err', text: `${err.message}${left}` });
      } else {
        setResult({ kind: 'err', text: 'Sem conexão com o computador. Confira o endereço e a rede Wi-Fi.' });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Pareamento com o computador</h2>
      <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: 14 }}>
        Leia o QR code no computador, ou digite o código de 6 dígitos mostrado nele. O código vale uma vez e expira em 5 minutos.
      </p>
      <div style={{ display: 'grid', gap: 12 }}>
        <label className="field">
          Identificador da sessão
          <input className="input" value={sessionId} onChange={(e) => setSessionId(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        </label>
        <label className="field">
          Código de 6 dígitos
          <input className="input" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
        </label>
        <div className="actions">
          <button className="btn primary" onClick={submit} disabled={busy || !sessionId || code.length !== 6}>
            {busy ? 'Pareando…' : 'Parear'}
          </button>
        </div>
        {result && <div className={`banner ${result.kind === 'ok' ? 'ok' : 'err'}`}>{result.text}</div>}
        {token && (
          <dl className="kv">
            <dt>Sessão</dt>
            <dd>ativa nesta aba (token em memória)</dd>
          </dl>
        )}
      </div>
    </section>
  );
}

import { useEffect, useState } from 'react';
import type { DesktopSettings } from '../types';

/** Configurações locais: portas, endereço da LAN e atalho de teste neste PC. */
export function SettingsCard({ settings, onSaved }: { settings: DesktopSettings; onSaved: (s: DesktopSettings) => void }) {
  const [draft, setDraft] = useState(settings);
  const [lan, setLan] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void window.icam.lanAddresses().then(setLan);
  }, []);

  async function save() {
    const saved = await window.icam.saveSettings(draft);
    onSaved(saved);
    setDraft(saved);
    setMessage('Configurações salvas.');
  }

  return (
    <section className="card">
      <h2>Configurações</h2>
      <div className="form">
        <label className="field">
          Porta da API local (somente este PC)
          <input className="input" type="number" min={1024} max={65535} value={draft.localPort}
            onChange={(e) => setDraft({ ...draft, localPort: Number(e.target.value) })} />
        </label>
        <label className="field">
          Porta HTTPS para o iPhone
          <input className="input" type="number" min={1024} max={65535} value={draft.publicPort}
            onChange={(e) => setDraft({ ...draft, publicPort: Number(e.target.value) })} />
        </label>
        <label className="field">
          Endereço deste PC na rede Wi-Fi
          <select className="input" value={draft.lanAddress} onChange={(e) => setDraft({ ...draft, lanAddress: e.target.value })}>
            <option value="">Automático ({lan[0] ?? 'não encontrado'})</option>
            {lan.map((ip) => (
              <option key={ip} value={ip}>{ip}</option>
            ))}
          </select>
        </label>
        <div className="actions">
          <button className="btn primary" onClick={save}>Salvar</button>
          <button className="btn" onClick={() => window.icam.openLocalPreview()}>Abrir PWA neste PC</button>
        </div>
        {message && <p className="muted small">{message}</p>}
      </div>
    </section>
  );
}

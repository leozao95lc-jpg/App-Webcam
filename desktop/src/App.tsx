import { useEffect, useState } from 'react';
import { PairingCard } from './components/PairingCard';
import { ServerCard } from './components/ServerCard';
import { SettingsCard } from './components/SettingsCard';
import type { DesktopSettings } from './types';

/**
 * Janela principal do iCam Studio 4K (Windows).
 * Fase atual: servidor, pareamento e configuração. Preview, telemetria e OBS entram nas fases 2 a 4.
 */
export function App() {
  const [settings, setSettings] = useState<DesktopSettings | null>(null);
  const [serverOk, setServerOk] = useState<boolean | null>(null);

  useEffect(() => {
    void window.icam.getSettings().then(setSettings);
  }, []);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      const h = await window.icam.serverHealth();
      if (alive) setServerOk(h.ok);
    };
    void poll();
    const id = window.setInterval(poll, 2000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="dot" aria-hidden />
          iCam Studio 4K
        </div>
        <div className={`pill ${serverOk ? 'ok' : serverOk === false ? 'err' : ''}`}>
          {serverOk === null ? 'Verificando servidor…' : serverOk ? 'Servidor ativo' : 'Servidor desligado'}
        </div>
      </header>

      <main className="grid">
        <ServerCard online={serverOk} />
        <PairingCard enabled={serverOk === true} />
        {settings && <SettingsCard settings={settings} onSaved={setSettings} />}
      </main>
    </div>
  );
}

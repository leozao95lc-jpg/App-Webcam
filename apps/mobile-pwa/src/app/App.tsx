import { useEffect, useState } from 'react';
import { CaptureScreen } from '../capture/CaptureScreen';
import { DiagnosticsScreen } from '../diagnostics/DiagnosticsScreen';
import { PairingPanel } from '../components/PairingPanel';

type Tab = 'capture' | 'diagnostics' | 'pairing';

const TABS: { id: Tab; label: string }[] = [
  { id: 'capture', label: 'Câmera' },
  { id: 'diagnostics', label: 'Diagnóstico' },
  { id: 'pairing', label: 'Pareamento' },
];

export function App() {
  const [tab, setTab] = useState<Tab>(() => (location.hash.startsWith('#pair=') ? 'pairing' : 'capture'));

  useEffect(() => {
    const onHash = () => {
      if (location.hash.startsWith('#pair=')) setTab('pairing');
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <div className="shell">
      <header className="topbar">
        <strong className="brand">iCam Studio 4K</strong>
        <nav className="tabs" aria-label="Seções">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? 'tab active' : 'tab'}
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="content">
        {tab === 'capture' && <CaptureScreen />}
        {tab === 'diagnostics' && <DiagnosticsScreen />}
        {tab === 'pairing' && <PairingPanel />}
      </main>
    </div>
  );
}

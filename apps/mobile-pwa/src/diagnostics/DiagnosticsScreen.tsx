import { useMemo, useRef, useState } from 'react';
import type { CameraCapabilitySnapshot, CameraDeviceInfo, CompatibilityReport, MatrixResult } from '@icam/shared-types';
import { CameraManager, normalizeCapabilities } from '../camera/CameraManager';
import { DEFAULT_MATRIX } from '../camera/matrix';
import { buildReport, runMatrix } from '../camera/matrixRunner';

/**
 * Relatório de compatibilidade: roda a matriz de alvos com medição real e exporta um JSON.
 * Não presume nenhum resultado. Tudo que aparece foi medido nesta execução.
 */
export function DiagnosticsScreen() {
  const managerRef = useRef<CameraManager | null>(null);
  if (!managerRef.current) managerRef.current = new CameraManager();
  const manager = managerRef.current;
  const videoRef = useRef<HTMLVideoElement>(null);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const [results, setResults] = useState<MatrixResult[] | null>(null);
  const [report, setReport] = useState<CompatibilityReport | null>(null);
  const [devices, setDevices] = useState<CameraDeviceInfo[]>([]);
  const [caps, setCaps] = useState<CameraCapabilitySnapshot>({ supported: false });
  const [fatal, setFatal] = useState<string | null>(null);

  const summary = useMemo(() => {
    if (!results) return null;
    const count = (v: MatrixResult['verdict']) => results.filter((r) => r.verdict === v).length;
    return { accepted: count('accepted'), downgraded: count('downgraded'), rejected: count('rejected'), error: count('error') };
  }, [results]);

  async function run() {
    setRunning(true);
    setFatal(null);
    setResults(null);
    setReport(null);
    try {
      manager.initialize();
      // Abrir uma captura curta antes da matriz concede permissão e revela os rótulos das câmeras.
      await manager.startCamera({ width: 640, height: 480, frameRate: 30, facing: 'environment' });
      const list = await manager.enumerateDevices();
      const capabilities = normalizeCapabilities(manager.getTrack()?.getCapabilities?.());
      manager.stopCamera();
      setDevices(list);
      setCaps(capabilities);

      const matrix = await runMatrix({
        manager,
        video: videoRef.current!,
        targets: DEFAULT_MATRIX,
        onProgress: (done, total, label) => setProgress({ done, total, label }),
      });
      setResults(matrix);
      setReport(
        buildReport({
          matrix,
          devices: list,
          capabilities,
          userAgent: navigator.userAgent,
          secureContext: window.isSecureContext,
        }),
      );
    } catch (err) {
      setFatal(err instanceof Error ? err.message : 'Falha desconhecida no diagnóstico.');
    } finally {
      manager.stopCamera();
      setRunning(false);
      setProgress(null);
    }
  }

  function exportJson() {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `icam-compatibilidade-${report.generatedAt.replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <section className="card">
        <h2>Diagnóstico de captura</h2>
        <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: 14 }}>
          Testa cada configuração abaixo, uma por vez, e mede os frames realmente apresentados. Leva cerca de 40 segundos.
        </p>
        <ul className="limits" style={{ marginBottom: 12 }}>
          {DEFAULT_MATRIX.map((t) => (
            <li key={t.label}>{t.label}</li>
          ))}
        </ul>
        <div className="actions">
          <button className="btn primary" onClick={run} disabled={running}>
            {running ? 'Testando…' : 'Executar diagnóstico'}
          </button>
          <button className="btn" onClick={exportJson} disabled={!report}>
            Exportar relatório (JSON)
          </button>
        </div>
        {progress && (
          <p style={{ marginTop: 12, color: 'var(--muted)' }}>
            {progress.label === 'concluído' ? 'Concluído.' : `Testando ${progress.label} (${progress.done + 1}/${progress.total})…`}
          </p>
        )}
        {fatal && <div className="banner err" style={{ marginTop: 12 }}>{fatal}</div>}
        {/* Elemento de medição: precisa estar renderizado para o navegador apresentar frames. */}
        <div style={{ marginTop: 12, width: 240, aspectRatio: '16 / 9', borderRadius: 8, overflow: 'hidden', background: '#000' }}>
          <video ref={videoRef} playsInline muted autoPlay style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
      </section>

      {summary && results && (
        <section className="card">
          <h2>Resultados medidos</h2>
          <div className="banner" style={{ marginBottom: 12 }}>
            Confirmados: {summary.accepted} · Abaixo do pedido: {summary.downgraded} · Recusados: {summary.rejected} · Erros: {summary.error}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Alvo</th>
                  <th>Veredito</th>
                  <th>Resolução</th>
                  <th>FPS medido</th>
                  <th>Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.target.label}>
                    <td>{r.target.label}</td>
                    <td className={`verdict ${r.verdict}`}>{VERDICT_LABEL[r.verdict]}</td>
                    <td>
                      {r.applied.width && r.applied.height ? `${r.applied.width}×${r.applied.height}` : '—'}
                    </td>
                    <td>
                      {r.measuredFps !== undefined ? r.measuredFps.toFixed(1) : '—'}
                      {r.fpsMethod === 'raf-estimate' && <div style={{ color: 'var(--warn)', fontSize: 12 }}>estimado</div>}
                    </td>
                    <td style={{ color: 'var(--muted)' }}>{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {devices.length > 0 && (
        <section className="card">
          <h2>Câmeras e capacidades</h2>
          <dl className="kv">
            <dt>Câmeras</dt>
            <dd>{devices.map((d) => d.label || 'câmera sem rótulo').join(' · ')}</dd>
            <dt>getCapabilities()</dt>
            <dd>{caps.supported ? 'disponível' : 'não disponível neste navegador'}</dd>
          </dl>
        </section>
      )}

      {report && (
        <section className="card">
          <h2>Limitações registradas</h2>
          <ul className="limits">
            {report.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

const VERDICT_LABEL: Record<MatrixResult['verdict'], string> = {
  accepted: 'Confirmado',
  downgraded: 'Abaixo do pedido',
  rejected: 'Recusado',
  error: 'Erro',
};

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppliedSettings, CameraCapabilitySnapshot } from '@icam/shared-types';
import { CameraError, CameraManager } from '../camera/CameraManager';
import { FpsMeter } from '../telemetry/fpsMeter';
import { DEFAULT_MATRIX } from '../camera/matrix';
import { errorMessageFor } from '../camera/messages';

/**
 * Tela de captura. Mostra o que o navegador REALMENTE aplicou e o FPS medido ao vivo.
 * O pedido inicial é 4K60 (meta). Não há fallback silencioso: o resultado aparece como está.
 */
export function CaptureScreen() {
  const managerRef = useRef<CameraManager | null>(null);
  if (!managerRef.current) managerRef.current = new CameraManager();
  const manager = managerRef.current;

  const videoRef = useRef<HTMLVideoElement>(null);
  const [running, setRunning] = useState(false);
  const [applied, setApplied] = useState<AppliedSettings>({});
  const [caps, setCaps] = useState<CameraCapabilitySnapshot | null>(null);
  const [liveFps, setLiveFps] = useState<number | null>(null);
  const [rendered, setRendered] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');

  const target = useMemo(() => DEFAULT_MATRIX[0], []);

  const stopLoop = useRef<(() => void) | null>(null);

  const attachLiveMeter = useCallback((video: HTMLVideoElement) => {
    const meter = new FpsMeter(1000);
    let cancelled = false;
    const hasRVFC = typeof (video as { requestVideoFrameCallback?: unknown }).requestVideoFrameCallback === 'function';

    if (hasRVFC) {
      const loop = (now: number) => {
        if (cancelled) return;
        meter.record(now);
        setLiveFps(Number(meter.fps(now).toFixed(1)));
        setRendered({ w: video.videoWidth, h: video.videoHeight });
        video.requestVideoFrameCallback(loop);
      };
      video.requestVideoFrameCallback(loop);
    } else {
      let raf = 0;
      const loop = (now: number) => {
        if (cancelled) return;
        meter.record(now);
        setLiveFps(Number(meter.fps(now).toFixed(1)));
        setRendered({ w: video.videoWidth, h: video.videoHeight });
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf);
      };
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const start = useCallback(
    async (nextFacing: 'environment' | 'user') => {
      setError(null);
      try {
        const settings = await manager.startCamera({
          width: target.width,
          height: target.height,
          frameRate: target.fps,
          facing: nextFacing,
        });
        const video = videoRef.current!;
        video.srcObject = manager.getStream();
        await video.play();
        setApplied(settings);
        setCaps(manager.getCapabilities());
        setFacing(nextFacing);
        setRunning(true);
        stopLoop.current?.();
        stopLoop.current = attachLiveMeter(video);
      } catch (err) {
        setRunning(false);
        setError(err instanceof CameraError ? errorMessageFor(err) : 'Falha inesperada ao iniciar a câmera.');
      }
    },
    [attachLiveMeter, manager, target],
  );

  const stop = useCallback(() => {
    stopLoop.current?.();
    stopLoop.current = null;
    manager.stopCamera();
    if (videoRef.current) videoRef.current.srcObject = null;
    setRunning(false);
    setLiveFps(null);
    setRendered(null);
  }, [manager]);

  const switchCam = useCallback(async () => {
    setError(null);
    try {
      stopLoop.current?.();
      const settings = await manager.switchCamera();
      const video = videoRef.current!;
      video.srcObject = manager.getStream();
      await video.play();
      setApplied(settings);
      setCaps(manager.getCapabilities());
      setFacing(facing === 'environment' ? 'user' : 'environment');
      stopLoop.current = attachLiveMeter(video);
    } catch (err) {
      setError(err instanceof CameraError ? errorMessageFor(err) : 'Falha ao trocar de câmera.');
    }
  }, [attachLiveMeter, facing, manager]);

  useEffect(() => {
    return () => {
      stopLoop.current?.();
      manager.stopCamera();
    };
  }, [manager]);

  const width = applied.width ?? rendered?.w;
  const height = applied.height ?? rendered?.h;
  const resolutionLabel = width && height ? `${width} × ${height}` : '—';
  const is4k = (width ?? 0) >= 3840 && (height ?? 0) >= 2160;

  return (
    <>
      <section className="card">
        <h2>Pré-visualização</h2>
        <div className="preview">
          <video ref={videoRef} playsInline muted autoPlay hidden={!running} />
          {!running && (
            <div className="preview-empty">
              {error ?? 'Toque em "Iniciar câmera" para abrir a câmera traseira.'}
            </div>
          )}
        </div>
        <div className="actions" style={{ marginTop: 12 }}>
          {!running ? (
            <button className="btn primary" onClick={() => start('environment')}>
              Iniciar câmera
            </button>
          ) : (
            <>
              <button className="btn" onClick={switchCam}>
                Trocar para {facing === 'environment' ? 'frontal' : 'traseira'}
              </button>
              <button className="btn primary" onClick={stop}>
                Parar
              </button>
            </>
          )}
        </div>
        {error && running && <div className="banner err" style={{ marginTop: 10 }}>{error}</div>}
      </section>

      <section className="card">
        <h2>Configuração efetiva</h2>
        <dl className="kv">
          <dt>Meta</dt>
          <dd>{target.label} (pedido ideal)</dd>
          <dt>Resolução aplicada</dt>
          <dd>{resolutionLabel}</dd>
          <dt>Frames renderizados</dt>
          <dd>{rendered ? `${rendered.w} × ${rendered.h}` : '—'}</dd>
          <dt>FPS aplicado</dt>
          <dd>{applied.frameRate ? applied.frameRate.toFixed(1) : '—'}</dd>
          <dt>FPS medido agora</dt>
          <dd>{liveFps !== null ? liveFps.toFixed(1) : '—'}</dd>
          <dt>Direção</dt>
          <dd>{running ? (facing === 'environment' ? 'traseira' : 'frontal') : '—'}</dd>
        </dl>
        {running && !is4k && (
          <div className="banner warn" style={{ marginTop: 12 }}>
            O navegador entregou {resolutionLabel}. Não é 4K: a meta 4K ainda não foi atingida neste aparelho.
          </div>
        )}
        {running && is4k && liveFps !== null && liveFps < target.fps * 0.9 && (
          <div className="banner warn" style={{ marginTop: 12 }}>
            4K confirmado, mas o FPS medido ({liveFps.toFixed(1)}) está abaixo de {target.fps}. Rode o diagnóstico para o relatório completo.
          </div>
        )}
      </section>

      <section className="card">
        <h2>Capacidades reportadas pelo navegador</h2>
        {!caps && <p style={{ color: 'var(--muted)', margin: 0 }}>Disponível após iniciar a câmera.</p>}
        {caps && !caps.supported && (
          <div className="banner warn">
            Este navegador não implementou getCapabilities() para a câmera. Nenhum limite foi presumido.
          </div>
        )}
        {caps?.supported && (
          <dl className="kv">
            <dt>Largura</dt>
            <dd>{rangeLabel(caps.width)}</dd>
            <dt>Altura</dt>
            <dd>{rangeLabel(caps.height)}</dd>
            <dt>FPS</dt>
            <dd>{rangeLabel(caps.frameRate)}</dd>
            <dt>Zoom</dt>
            <dd>{rangeLabel(caps.zoom)}</dd>
          </dl>
        )}
      </section>
    </>
  );
}

function rangeLabel(r?: { min?: number; max?: number }): string {
  if (!r || (r.min === undefined && r.max === undefined)) return '—';
  return `${r.min ?? '?'} até ${r.max ?? '?'}`;
}

import type {
  CameraCapabilitySnapshot,
  CameraDeviceInfo,
  CompatibilityReport,
  MatrixResult,
  MatrixTarget,
} from '@icam/shared-types';
import { measureVideoFps } from '../telemetry/measureFps';
import { CameraManager } from './CameraManager';
import { DEFAULT_MATRIX, REPORT_LIMITATIONS, classifyError, classifyMeasurement } from './matrix';

export interface MatrixRunOptions {
  manager: CameraManager;
  video: HTMLVideoElement;
  targets?: readonly MatrixTarget[];
  /** Tempo de estabilização após abrir a câmera, antes de medir. */
  warmupMs?: number;
  /** Janela de medição de FPS para cada alvo. */
  durationMs?: number;
  onProgress?: (done: number, total: number, label: string) => void;
  sleep?: (ms: number) => Promise<void>;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Executa a matriz de alvos em sequência, um por vez (nunca duas capturas simultâneas).
 * Cada alvo: abre a câmera com ideal, espera estabilizar, mede frames apresentados, lê settings reais.
 */
export async function runMatrix(opts: MatrixRunOptions): Promise<MatrixResult[]> {
  const targets = opts.targets ?? DEFAULT_MATRIX;
  const warmupMs = opts.warmupMs ?? 1500;
  const durationMs = opts.durationMs ?? 5000;
  const sleep = opts.sleep ?? wait;
  const results: MatrixResult[] = [];

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    opts.onProgress?.(i, targets.length, target.label);
    const started = performance.now();
    try {
      const applied = await opts.manager.startCamera({
        width: target.width,
        height: target.height,
        frameRate: target.fps,
        facing: 'environment',
      });
      const stream = opts.manager.getStream();
      opts.video.srcObject = stream;
      await opts.video.play();
      await sleep(warmupMs);

      const measurement = await measureVideoFps(opts.video, durationMs);
      const settled = opts.manager.getActualSettings();
      const { verdict, note } = classifyMeasurement(
        target,
        { ...applied, ...settled },
        { width: measurement.renderedWidth, height: measurement.renderedHeight },
        measurement.fps,
      );
      results.push({
        target,
        verdict,
        applied: { ...applied, ...settled },
        renderedWidth: measurement.renderedWidth,
        renderedHeight: measurement.renderedHeight,
        measuredFps: Number(measurement.fps.toFixed(2)),
        fpsMethod: measurement.method,
        durationMs: Math.round(performance.now() - started),
        note,
      });
    } catch (err) {
      results.push(classifyError(target, err, Math.round(performance.now() - started)));
    } finally {
      opts.manager.stopCamera();
      opts.video.srcObject = null;
    }
  }
  opts.onProgress?.(targets.length, targets.length, 'concluído');
  return results;
}

/** Monta o relatório exportável. Função pura: fácil de testar e de versionar. */
export function buildReport(input: {
  matrix: MatrixResult[];
  devices: CameraDeviceInfo[];
  capabilities: CameraCapabilitySnapshot;
  userAgent: string;
  secureContext: boolean;
  now?: Date;
}): CompatibilityReport {
  return {
    schema: 'icam.compatibility.v1',
    generatedAt: (input.now ?? new Date()).toISOString(),
    userAgent: input.userAgent,
    secureContext: input.secureContext,
    devices: input.devices,
    capabilities: input.capabilities,
    matrix: input.matrix,
    limitations: [...REPORT_LIMITATIONS],
  };
}

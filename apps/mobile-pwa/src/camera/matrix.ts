import type { AppliedSettings, MatrixResult, MatrixTarget, MatrixVerdict } from '@icam/shared-types';
import { CameraError } from './CameraManager';

/**
 * Alvos da matriz de compatibilidade, do mais exigente ao mais seguro.
 * 4K60 é a meta; os demais existem para mostrar o que o Safari realmente entrega.
 */
export const DEFAULT_MATRIX: readonly MatrixTarget[] = [
  { label: '4K 60 FPS', width: 3840, height: 2160, fps: 60 },
  { label: '4K 30 FPS', width: 3840, height: 2160, fps: 30 },
  { label: '1080p 60 FPS', width: 1920, height: 1080, fps: 60 },
  { label: '1080p 30 FPS', width: 1920, height: 1080, fps: 30 },
  { label: '720p 30 FPS', width: 1280, height: 720, fps: 30 },
];

/** O FPS medido precisa atingir pelo menos esta fração do pedido para contar como aceito. */
export const FPS_TOLERANCE = 0.9;

export interface Classification {
  verdict: MatrixVerdict;
  note: string;
}

/**
 * Classifica uma medição real. "accepted" exige resolução aplicada, frames renderizados
 * e FPS medido compatíveis com o pedido. Nada é aceito só porque o navegador declarou.
 */
export function classifyMeasurement(
  target: MatrixTarget,
  applied: AppliedSettings,
  rendered: { width: number; height: number },
  measuredFps: number,
): Classification {
  const notes: string[] = [];
  const appliedW = applied.width ?? 0;
  const appliedH = applied.height ?? 0;

  const sizeOk = appliedW === target.width && appliedH === target.height;
  const renderedOk = rendered.width === target.width && rendered.height === target.height;
  const fpsOk = measuredFps >= target.fps * FPS_TOLERANCE;

  notes.push(`Aplicado ${appliedW}x${appliedH}`);
  if (!renderedOk) notes.push(`frames renderizados ${rendered.width}x${rendered.height}`);
  notes.push(`FPS medido ${measuredFps.toFixed(1)} (pedido ${target.fps})`);

  if (sizeOk && renderedOk && fpsOk) {
    return { verdict: 'accepted', note: `${notes.join('; ')}. Confirmado por medição.` };
  }
  return { verdict: 'downgraded', note: `${notes.join('; ')}. Abaixo do pedido: não declarar ${target.label}.` };
}

/** Converte um erro de captura num resultado da matriz, sem perder a causa. */
export function classifyError(target: MatrixTarget, err: unknown, durationMs: number): MatrixResult {
  if (err instanceof CameraError) {
    const verdict: MatrixVerdict = err.code === 'overconstrained' ? 'rejected' : 'error';
    return {
      target,
      verdict,
      applied: {},
      durationMs,
      errorName: err.causeName ?? err.code,
      note: err.message,
    };
  }
  const message = err instanceof Error ? err.message : 'erro desconhecido';
  return { target, verdict: 'error', applied: {}, durationMs, errorName: 'unknown', note: message };
}

/** Limitações que valem para todo relatório. Entram no arquivo exportado. */
export const REPORT_LIMITATIONS: readonly string[] = [
  'O Safari pode aceitar uma configuração e entregar resolução ou FPS menores. O relatório mostra o medido, não o pedido.',
  'FPS medido por requestVideoFrameCallback conta frames apresentados no elemento de vídeo, não o fluxo de rede.',
  'Quando o FPS é estimado (raf-estimate), o resultado não deve ser usado como prova de 60 FPS.',
  'Nenhum upscaling é aplicado: abaixo de 3840x2160 não se declara 4K.',
  'Resultados em navegadores de desktop não substituem a medição no iPhone 17.',
];

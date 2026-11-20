import { describe, expect, it } from 'vitest';
import { classifyError, classifyMeasurement, DEFAULT_MATRIX, FPS_TOLERANCE } from '../camera/matrix';
import { CameraError } from '../camera/CameraManager';

const t4k60 = DEFAULT_MATRIX[0];

describe('classifyMeasurement', () => {
  it('aceita somente quando resolução, renderização e FPS medido batem', () => {
    const r = classifyMeasurement(t4k60, { width: 3840, height: 2160 }, { width: 3840, height: 2160 }, 59.5);
    expect(r.verdict).toBe('accepted');
    expect(r.note).toContain('Confirmado por medição');
  });

  it('rebaixa quando o navegador entrega resolução menor, mesmo com FPS alto', () => {
    const r = classifyMeasurement(t4k60, { width: 1920, height: 1080 }, { width: 1920, height: 1080 }, 60);
    expect(r.verdict).toBe('downgraded');
    expect(r.note).toContain('não declarar 4K 60 FPS');
  });

  it('rebaixa quando o FPS medido fica abaixo da tolerância', () => {
    const limit = t4k60.fps * FPS_TOLERANCE;
    const below = classifyMeasurement(t4k60, { width: 3840, height: 2160 }, { width: 3840, height: 2160 }, limit - 0.5);
    expect(below.verdict).toBe('downgraded');
    const atLimit = classifyMeasurement(t4k60, { width: 3840, height: 2160 }, { width: 3840, height: 2160 }, limit);
    expect(atLimit.verdict).toBe('accepted');
  });

  it('rebaixa quando o frame renderizado não bate com o aplicado', () => {
    const r = classifyMeasurement(t4k60, { width: 3840, height: 2160 }, { width: 1280, height: 720 }, 60);
    expect(r.verdict).toBe('downgraded');
    expect(r.note).toContain('frames renderizados 1280x720');
  });

  it('nunca aceita sem dimensões aplicadas conhecidas', () => {
    const r = classifyMeasurement(t4k60, {}, { width: 3840, height: 2160 }, 60);
    expect(r.verdict).toBe('downgraded');
  });
});

describe('classifyError', () => {
  it('OverconstrainedError vira "rejected" com causa preservada', () => {
    const err = new CameraError('overconstrained', 'x', 'OverconstrainedError');
    const r = classifyError(t4k60, err, 10);
    expect(r.verdict).toBe('rejected');
    expect(r.errorName).toBe('OverconstrainedError');
  });

  it('permissão negada vira "error", não "rejected"', () => {
    const r = classifyError(t4k60, new CameraError('permission_denied', 'negada', 'NotAllowedError'), 10);
    expect(r.verdict).toBe('error');
  });

  it('erro não previsto ainda vira resultado de erro, sem lançar', () => {
    const r = classifyError(t4k60, new Error('boom'), 10);
    expect(r.verdict).toBe('error');
    expect(r.note).toBe('boom');
  });
});

describe('DEFAULT_MATRIX', () => {
  it('começa pela meta 4K60 e inclui 4K30 e 1080p60 como alternativas', () => {
    expect(DEFAULT_MATRIX[0]).toMatchObject({ width: 3840, height: 2160, fps: 60 });
    expect(DEFAULT_MATRIX.some((t) => t.width === 3840 && t.fps === 30)).toBe(true);
    expect(DEFAULT_MATRIX.some((t) => t.width === 1920 && t.fps === 60)).toBe(true);
  });
});

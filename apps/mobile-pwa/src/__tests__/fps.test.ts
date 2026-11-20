import { describe, expect, it } from 'vitest';
import { FpsMeter } from '../telemetry/fpsMeter';
import { computeFps } from '../telemetry/measureFps';

describe('FpsMeter', () => {
  it('mede 30 FPS num fluxo estável de 30 frames por segundo', () => {
    const m = new FpsMeter(1000);
    for (let i = 0; i < 60; i++) m.record((i * 1000) / 30);
    const last = (59 * 1000) / 30;
    expect(m.fps(last)).toBeCloseTo(30, 0);
  });

  it('descarta frames fora da janela', () => {
    const m = new FpsMeter(1000);
    m.record(0);
    m.record(500);
    expect(m.fps(1200)).toBe(1);
    expect(m.fps(5000)).toBe(0);
  });

  it('rejeita janela não positiva', () => {
    expect(() => new FpsMeter(0)).toThrow(RangeError);
  });
});

describe('computeFps', () => {
  it('calcula frames por segundo a partir de contagem e tempo', () => {
    expect(computeFps(150, 5000)).toBe(30);
  });
  it('retorna zero para tempo nulo, sem dividir por zero', () => {
    expect(computeFps(10, 0)).toBe(0);
  });
});

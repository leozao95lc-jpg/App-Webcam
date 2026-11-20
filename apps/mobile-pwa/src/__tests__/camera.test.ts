import { describe, expect, it, vi } from 'vitest';
import { CameraError, CameraManager, buildVideoConstraints, guessFacing, mapMediaError, normalizeCapabilities } from '../camera/CameraManager';
import { parsePairFragment } from '../services/signalingApi';

function domError(name: string): Error {
  const e = new Error(name);
  e.name = name;
  return e;
}

describe('mapMediaError', () => {
  it.each([
    ['NotAllowedError', 'permission_denied'],
    ['NotFoundError', 'not_found'],
    ['OverconstrainedError', 'overconstrained'],
    ['NotReadableError', 'busy'],
    ['AbortError', 'unknown'],
  ])('%s -> %s', (name, code) => {
    expect(mapMediaError(domError(name)).code).toBe(code);
  });
});

describe('buildVideoConstraints', () => {
  it('pede resolução, FPS e direção como IDEAIS, nunca exatos', () => {
    const c = buildVideoConstraints({ width: 3840, height: 2160, frameRate: 60 });
    expect(c.width).toEqual({ ideal: 3840 });
    expect(c.frameRate).toEqual({ ideal: 60 });
    expect(c.facingMode).toEqual({ ideal: 'environment' });
  });
  it('usa deviceId exato somente quando a câmera foi escolhida', () => {
    const c = buildVideoConstraints({ width: 1280, height: 720, frameRate: 30, deviceId: 'abc' });
    expect(c.deviceId).toEqual({ exact: 'abc' });
  });
});

describe('normalizeCapabilities', () => {
  it('sem getCapabilities, não inventa limites', () => {
    expect(normalizeCapabilities(undefined)).toEqual({ supported: false });
  });
  it('copia faixas reportadas', () => {
    const caps = normalizeCapabilities({ width: { min: 320, max: 3840 }, frameRate: { min: 1, max: 60 } } as MediaTrackCapabilities);
    expect(caps.supported).toBe(true);
    expect(caps.width).toEqual({ min: 320, max: 3840 });
    expect(caps.frameRate).toEqual({ min: 1, max: 60 });
    expect(caps.height).toBeUndefined();
  });
});

describe('guessFacing', () => {
  it('reconhece traseira e frontal pelo rótulo, e devolve unknown quando não há pista', () => {
    expect(guessFacing('Câmera traseira ultra grande angular')).toBe('environment');
    expect(guessFacing('Front Camera')).toBe('user');
    expect(guessFacing('FaceTime HD')).toBe('unknown');
  });
});

describe('CameraManager', () => {
  it('recusa contexto inseguro antes de tentar a câmera', () => {
    const getUserMedia = vi.fn();
    const m = new CameraManager({ isSecureContext: false, mediaDevices: { getUserMedia, enumerateDevices: vi.fn() } as never });
    expect(() => m.initialize()).toThrow(CameraError);
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('startCamera traduz NotAllowedError em CameraError permission_denied', async () => {
    const m = new CameraManager({
      isSecureContext: true,
      mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(domError('NotAllowedError')), enumerateDevices: vi.fn() } as never,
    });
    await expect(m.startCamera({ width: 3840, height: 2160, frameRate: 60 })).rejects.toMatchObject({ code: 'permission_denied' });
  });

  it('startCamera devolve as configurações lidas da faixa, não as pedidas', async () => {
    const settings = { width: 1920, height: 1080, frameRate: 30, deviceId: 'd1' };
    const track = {
      stop: vi.fn(),
      getSettings: () => settings,
      getCapabilities: undefined,
    };
    const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
    const m = new CameraManager({
      isSecureContext: true,
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream), enumerateDevices: vi.fn() } as never,
    });
    const applied = await m.startCamera({ width: 3840, height: 2160, frameRate: 60 });
    expect(applied.width).toBe(1920);
    expect(applied.frameRate).toBe(30);
    expect(m.getCapabilities()).toEqual({ supported: false });
  });
});

describe('parsePairFragment', () => {
  const sid = '0123456789abcdef0123456789abcdef';
  it('lê #pair=<sessão>.<código>', () => {
    expect(parsePairFragment(`#pair=${sid}.123456`)).toEqual({ sessionId: sid, code: '123456' });
  });
  it('recusa formatos inválidos', () => {
    expect(parsePairFragment(`#pair=${sid}.12345`)).toBeNull();
    expect(parsePairFragment(`#pair=XYZ.123456`)).toBeNull();
    expect(parsePairFragment('')).toBeNull();
  });
});

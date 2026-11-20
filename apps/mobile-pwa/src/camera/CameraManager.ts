import type {
  AppliedSettings,
  CameraCapabilitySnapshot,
  CameraDeviceInfo,
  CameraFacing,
} from '@icam/shared-types';

/** Códigos estáveis de erro de câmera. A UI traduz para português. */
export type CameraErrorCode =
  | 'insecure_context'
  | 'unsupported'
  | 'permission_denied'
  | 'not_found'
  | 'overconstrained'
  | 'busy'
  | 'unknown';

export class CameraError extends Error {
  readonly code: CameraErrorCode;
  readonly causeName?: string;

  constructor(code: CameraErrorCode, message: string, causeName?: string) {
    super(message);
    this.name = 'CameraError';
    this.code = code;
    this.causeName = causeName;
  }
}

/** Pedido de captura. Os valores são IDEAIS: o navegador pode entregar algo menor, e isso é medido. */
export interface CameraRequest {
  width: number;
  height: number;
  frameRate: number;
  facing?: 'environment' | 'user';
  deviceId?: string;
}

/** Ambiente injetável para testes. Em produção vem do navegador. */
export interface CameraEnvironment {
  isSecureContext: boolean;
  mediaDevices: Pick<MediaDevices, 'getUserMedia' | 'enumerateDevices'> | undefined;
}

export function browserEnvironment(): CameraEnvironment {
  return {
    isSecureContext: typeof window !== 'undefined' && window.isSecureContext === true,
    mediaDevices: typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined,
  };
}

/** Converte exceções do navegador em CameraError com código estável. */
export function mapMediaError(err: unknown): CameraError {
  const name = err instanceof Error ? err.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return new CameraError('permission_denied', 'Permissão de câmera negada.', name);
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return new CameraError('not_found', 'Nenhuma câmera encontrada neste dispositivo.', name);
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return new CameraError('overconstrained', 'Esta câmera não aceita a configuração pedida.', name);
    case 'NotReadableError':
    case 'TrackStartError':
      return new CameraError('busy', 'A câmera está em uso por outro aplicativo.', name);
    default:
      return new CameraError('unknown', `Falha ao acessar a câmera${name ? ` (${name})` : ''}.`, name || undefined);
  }
}

/** Heurística pelo rótulo. O rótulo só aparece após permissão e nem sempre indica a direção. */
export function guessFacing(label: string): CameraFacing {
  if (/back|rear|traseira|environment|tr[aá]s/i.test(label)) return 'environment';
  if (/front|frontal|user|selfie/i.test(label)) return 'user';
  return 'unknown';
}

/** Restrições de vídeo para getUserMedia. Tudo em "ideal": nunca presumir que o navegador atende. */
export function buildVideoConstraints(req: CameraRequest): MediaTrackConstraints {
  const base: MediaTrackConstraints = {
    width: { ideal: req.width },
    height: { ideal: req.height },
    frameRate: { ideal: req.frameRate },
  };
  if (req.deviceId) return { ...base, deviceId: { exact: req.deviceId } };
  return { ...base, facingMode: { ideal: req.facing ?? 'environment' } };
}

/** Normaliza getCapabilities(). Ausência do método vira supported=false, sem inventar valores. */
export function normalizeCapabilities(
  raw: MediaTrackCapabilities | undefined,
): CameraCapabilitySnapshot {
  if (!raw) return { supported: false };
  const r = raw as MediaTrackCapabilities & { zoom?: { min?: number; max?: number } };
  return {
    supported: true,
    width: r.width ? { min: r.width.min, max: r.width.max } : undefined,
    height: r.height ? { min: r.height.min, max: r.height.max } : undefined,
    frameRate: r.frameRate ? { min: r.frameRate.min, max: r.frameRate.max } : undefined,
    facingMode: r.facingMode ? [...r.facingMode] : undefined,
    zoom: r.zoom ? { min: r.zoom.min, max: r.zoom.max } : undefined,
  };
}

export function toAppliedSettings(s: MediaTrackSettings): AppliedSettings {
  return {
    width: s.width,
    height: s.height,
    frameRate: s.frameRate,
    facingMode: s.facingMode,
    deviceId: s.deviceId,
  };
}

/** Gerencia o único MediaStream de vídeo do PWA. Não abre captura paralela. */
export class CameraManager {
  private stream: MediaStream | null = null;
  private lastRequest: CameraRequest | null = null;
  private facing: 'environment' | 'user' = 'environment';

  constructor(private readonly env: CameraEnvironment = browserEnvironment()) {}

  /** Verifica pré-requisitos. Safari só libera a câmera em contexto seguro (HTTPS ou localhost). */
  initialize(): void {
    if (!this.env.isSecureContext) {
      throw new CameraError('insecure_context', 'A câmera exige HTTPS. Abra o endereço https:// do computador.');
    }
    if (!this.env.mediaDevices?.getUserMedia) {
      throw new CameraError('unsupported', 'Este navegador não oferece acesso à câmera (getUserMedia).');
    }
  }

  /** Lista câmeras. Antes da permissão, os rótulos vêm vazios. */
  async enumerateDevices(): Promise<CameraDeviceInfo[]> {
    this.initialize();
    const list = await this.env.mediaDevices!.enumerateDevices();
    return list
      .filter((d) => d.kind === 'videoinput')
      .map((d) => ({ deviceId: d.deviceId, label: d.label, facing: guessFacing(d.label) }));
  }

  async startCamera(req: CameraRequest): Promise<AppliedSettings> {
    this.initialize();
    this.stopCamera();
    try {
      this.stream = await this.env.mediaDevices!.getUserMedia({
        audio: false,
        video: buildVideoConstraints(req),
      });
    } catch (err) {
      throw mapMediaError(err);
    }
    this.lastRequest = req;
    this.facing = req.facing ?? this.facing;
    return this.getActualSettings();
  }

  stopCamera(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  /** Alterna entre traseira e frontal reabrindo a captura com o último pedido. */
  async switchCamera(): Promise<AppliedSettings> {
    if (!this.lastRequest) throw new CameraError('unknown', 'Inicie a câmera antes de trocar.');
    const next = this.facing === 'environment' ? 'user' : 'environment';
    return this.startCamera({ ...this.lastRequest, facing: next, deviceId: undefined });
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  getTrack(): MediaStreamTrack | null {
    return this.stream?.getVideoTracks()[0] ?? null;
  }

  getCapabilities(): CameraCapabilitySnapshot {
    const track = this.getTrack();
    if (!track || typeof track.getCapabilities !== 'function') return { supported: false };
    return normalizeCapabilities(track.getCapabilities());
  }

  getActualSettings(): AppliedSettings {
    const track = this.getTrack();
    if (!track) return {};
    return toAppliedSettings(track.getSettings());
  }

  /** Pede novas restrições à faixa já aberta. Falhas viram CameraError. */
  async applyCameraConstraints(c: { width?: number; height?: number; frameRate?: number }): Promise<AppliedSettings> {
    const track = this.getTrack();
    if (!track) throw new CameraError('unknown', 'Nenhuma câmera ativa.');
    try {
      await track.applyConstraints({
        width: c.width !== undefined ? { ideal: c.width } : undefined,
        height: c.height !== undefined ? { ideal: c.height } : undefined,
        frameRate: c.frameRate !== undefined ? { ideal: c.frameRate } : undefined,
      });
    } catch (err) {
      throw mapMediaError(err);
    }
    return this.getActualSettings();
  }
}

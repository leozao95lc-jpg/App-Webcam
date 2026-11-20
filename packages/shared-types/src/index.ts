// Contratos compartilhados entre o PWA (iPhone), o app Desktop (Electron) e o servidor Go.
// Os nomes dos campos JSON são o contrato: o servidor Go espelha estes tipos em signaling-server/.

/** Direção da câmera conforme o navegador reporta (facingMode). */
export type CameraFacing = 'environment' | 'user' | 'unknown';

/** Dispositivo de vídeo listado por enumerateDevices(). O label só existe após permissão. */
export interface CameraDeviceInfo {
  deviceId: string;
  label: string;
  facing: CameraFacing;
}

/** Faixa aceita por uma constraint, como MediaTrackCapabilities reporta. */
export interface CapabilityRange {
  min?: number;
  max?: number;
}

/**
 * Capacidades reportadas por MediaStreamTrack.getCapabilities().
 * supported=false quando o navegador não implementa o método (comum em partes do Safari).
 */
export interface CameraCapabilitySnapshot {
  supported: boolean;
  width?: CapabilityRange;
  height?: CapabilityRange;
  frameRate?: CapabilityRange;
  facingMode?: string[];
  zoom?: CapabilityRange;
}

/** Configuração efetivamente aplicada, lida de MediaStreamTrack.getSettings(). */
export interface AppliedSettings {
  width?: number;
  height?: number;
  frameRate?: number;
  facingMode?: string;
  deviceId?: string;
}

/** Alvo de teste da matriz de compatibilidade. */
export interface MatrixTarget {
  label: string;
  width: number;
  height: number;
  fps: number;
}

/**
 * accepted:   o navegador entregou a resolução e o FPS pedidos (medidos, não apenas declarados).
 * downgraded: entregou stream, mas com resolução ou FPS abaixo do pedido.
 * rejected:   getUserMedia recusou a configuração (ex.: OverconstrainedError).
 * error:      falha de permissão, de câmera ausente ou outra causa.
 */
export type MatrixVerdict = 'accepted' | 'downgraded' | 'rejected' | 'error';

export interface MatrixResult {
  target: MatrixTarget;
  verdict: MatrixVerdict;
  applied: AppliedSettings;
  /** Dimensões dos frames que chegaram ao elemento <video>. Pode diferir de applied. */
  renderedWidth?: number;
  renderedHeight?: number;
  /** Frames apresentados por segundo, medidos durante a janela de teste. */
  measuredFps?: number;
  /** 'requestVideoFrameCallback' é medição real; 'raf-estimate' é estimativa e deve ser sinalizada. */
  fpsMethod?: 'requestVideoFrameCallback' | 'raf-estimate';
  durationMs: number;
  errorName?: string;
  note: string;
}

/** Relatório exportado pelo PWA. Schema versionado para o Desktop poder ler depois. */
export interface CompatibilityReport {
  schema: 'icam.compatibility.v1';
  generatedAt: string;
  userAgent: string;
  secureContext: boolean;
  devices: CameraDeviceInfo[];
  capabilities: CameraCapabilitySnapshot;
  matrix: MatrixResult[];
  limitations: string[];
}

/** POST /api/pair (iPhone -> servidor). */
export interface PairRequest {
  sessionId: string;
  code: string;
}

export interface PairResponse {
  token: string;
  tokenExpiresAt: string;
}

export interface ApiError {
  error: string;
  message: string;
  attemptsLeft?: number;
}

/** POST /api/sessions no servidor local (Desktop). */
export interface SessionCreated {
  sessionId: string;
  pairingCode: string;
  expiresAt: string;
}

export type PairingState = 'waiting' | 'paired' | 'expired' | 'locked';

export interface SessionStatus {
  state: PairingState;
  attemptsLeft: number;
  expiresAt: string;
}

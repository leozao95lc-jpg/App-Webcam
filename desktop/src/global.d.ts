import type { DesktopSettings } from './types';

/** API exposta pelo preload (electron/preload.ts). */
interface IcamApi {
  getSettings(): Promise<DesktopSettings>;
  saveSettings(partial: Partial<DesktopSettings>): Promise<DesktopSettings>;
  lanAddresses(): Promise<string[]>;
  serverHealth(): Promise<{ ok: boolean; detail?: string }>;
  createSession(): Promise<{ sessionId: string; pairingCode: string; expiresAt: string; pairUrl: string }>;
  sessionStatus(sessionId: string): Promise<{ state: 'waiting' | 'paired' | 'expired' | 'locked'; attemptsLeft: number; expiresAt: string }>;
  openLocalPreview(): Promise<boolean>;
}

declare global {
  interface Window {
    icam: IcamApi;
  }
}

export {};

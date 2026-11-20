import type { SessionCreated, SessionStatus } from '@icam/shared-types';

/**
 * Cliente da API LOCAL do servidor de sinalização (só loopback).
 * Roda no processo principal do Electron. A interface nunca chama o servidor diretamente.
 */
export class SignalingClient {
  constructor(private readonly baseUrl: string) {}

  async health(): Promise<{ ok: boolean; detail?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/health`, { signal: AbortSignal.timeout(2000) });
      return res.ok ? { ok: true } : { ok: false, detail: `HTTP ${res.status}` };
    } catch {
      return { ok: false, detail: 'servidor não está respondendo' };
    }
  }

  async createSession(): Promise<SessionCreated> {
    const res = await fetch(`${this.baseUrl}/api/sessions`, {
      method: 'POST',
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`não foi possível criar a sessão (HTTP ${res.status})`);
    return (await res.json()) as SessionCreated;
  }

  async sessionStatus(sessionId: string): Promise<SessionStatus> {
    if (!/^[0-9a-f]{32}$/.test(sessionId)) throw new Error('identificador de sessão inválido');
    const res = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/status`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`status indisponível (HTTP ${res.status})`);
    return (await res.json()) as SessionStatus;
  }
}

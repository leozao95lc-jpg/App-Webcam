import type { ApiError, PairResponse } from '@icam/shared-types';

/** Erro de API com o código estável do servidor e, quando houver, tentativas restantes. */
export class ApiRequestError extends Error {
  readonly code: string;
  readonly attemptsLeft?: number;

  constructor(status: number, body: Partial<ApiError>) {
    super(body.message ?? `Erro HTTP ${status}`);
    this.name = 'ApiRequestError';
    this.code = body.error ?? `http_${status}`;
    this.attemptsLeft = body.attemptsLeft;
  }
}

/** POST /api/pair no mesmo origem (o PWA é servido pelo próprio servidor HTTPS). */
export async function pairWithComputer(sessionId: string, code: string): Promise<PairResponse> {
  const res = await fetch('/api/pair', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, code }),
    cache: 'no-store',
  });
  const body = (await res.json().catch(() => ({}))) as Partial<PairResponse & ApiError>;
  if (!res.ok) throw new ApiRequestError(res.status, body);
  return body as PairResponse;
}

/** Lê o pedido de pareamento do fragmento da URL: #pair=<sessionId>.<código>. Fragmento não vai ao servidor. */
export function parsePairFragment(hash: string): { sessionId: string; code: string } | null {
  const match = /^#pair=([0-9a-f]{32})\.([0-9]{6})$/.exec(hash);
  return match ? { sessionId: match[1], code: match[2] } : null;
}

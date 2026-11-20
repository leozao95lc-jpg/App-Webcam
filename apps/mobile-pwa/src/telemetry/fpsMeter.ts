/**
 * Medidor de FPS por janela deslizante. Porta do FpsMeter do core C# (desktop, mesma semântica).
 * Janela (agora - windowMs, agora]: um fluxo estável de 30 FPS retorna 30 quando há 1 s de frames.
 */
export class FpsMeter {
  private readonly stamps: number[] = [];

  constructor(private readonly windowMs = 1000) {
    if (windowMs <= 0) throw new RangeError('A janela deve ser positiva.');
  }

  record(nowMs: number): void {
    this.stamps.push(nowMs);
    this.trim(nowMs);
  }

  fps(nowMs: number): number {
    this.trim(nowMs);
    return (this.stamps.length * 1000) / this.windowMs;
  }

  private trim(nowMs: number): void {
    const cutoff = nowMs - this.windowMs;
    let drop = 0;
    while (drop < this.stamps.length && this.stamps[drop] <= cutoff) drop++;
    if (drop > 0) this.stamps.splice(0, drop);
  }
}

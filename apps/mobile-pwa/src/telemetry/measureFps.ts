/** Resultado de uma medição de frames apresentados no elemento <video>. */
export interface FpsMeasurement {
  fps: number;
  frames: number;
  elapsedMs: number;
  method: 'requestVideoFrameCallback' | 'raf-estimate';
  renderedWidth: number;
  renderedHeight: number;
}

/** FPS = frames / tempo. Função pura para teste. */
export function computeFps(frames: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return (frames * 1000) / elapsedMs;
}

type VideoWithRVFC = HTMLVideoElement & {
  requestVideoFrameCallback: (cb: (now: number, meta: { presentedFrames: number }) => void) => number;
};

/**
 * Mede frames realmente apresentados pelo elemento <video> durante durationMs.
 * Usa requestVideoFrameCallback quando existe (medição real). Caso contrário, cai para
 * requestAnimationFrame, que só estima e é marcado como 'raf-estimate'.
 */
export function measureVideoFps(video: HTMLVideoElement, durationMs: number): Promise<FpsMeasurement> {
  const hasRVFC = typeof (video as Partial<VideoWithRVFC>).requestVideoFrameCallback === 'function';
  return hasRVFC ? measureWithRVFC(video as VideoWithRVFC, durationMs) : measureWithRaf(video, durationMs);
}

function measureWithRVFC(video: VideoWithRVFC, durationMs: number): Promise<FpsMeasurement> {
  return new Promise((resolve) => {
    const startedAt = performance.now();
    let firstPresented: number | null = null;
    let lastPresented = 0;
    let lastNow = startedAt;

    const tick = (now: number, meta: { presentedFrames: number }) => {
      if (firstPresented === null) firstPresented = meta.presentedFrames;
      lastPresented = meta.presentedFrames;
      lastNow = now;
      if (now - startedAt < durationMs) {
        video.requestVideoFrameCallback(tick);
      } else {
        const frames = Math.max(0, lastPresented - (firstPresented ?? lastPresented));
        const elapsedMs = lastNow - startedAt;
        resolve({
          fps: computeFps(frames, elapsedMs),
          frames,
          elapsedMs,
          method: 'requestVideoFrameCallback',
          renderedWidth: video.videoWidth,
          renderedHeight: video.videoHeight,
        });
      }
    };
    video.requestVideoFrameCallback(tick);
  });
}

function measureWithRaf(video: HTMLVideoElement, durationMs: number): Promise<FpsMeasurement> {
  return new Promise((resolve) => {
    const startedAt = performance.now();
    let frames = 0;
    let lastTime = -1;
    const step = (now: number) => {
      // Conta mudanças de currentTime como frames apresentados: aproximação, não medição direta.
      if (video.currentTime !== lastTime) {
        frames++;
        lastTime = video.currentTime;
      }
      if (now - startedAt < durationMs) {
        requestAnimationFrame(step);
      } else {
        const elapsedMs = now - startedAt;
        resolve({
          fps: computeFps(frames, elapsedMs),
          frames,
          elapsedMs,
          method: 'raf-estimate',
          renderedWidth: video.videoWidth,
          renderedHeight: video.videoHeight,
        });
      }
    };
    requestAnimationFrame(step);
  });
}

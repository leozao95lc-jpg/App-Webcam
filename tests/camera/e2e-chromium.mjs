// Teste de ponta a ponta do FLUXO do PWA num Chromium real, com a câmera FALSA do próprio navegador.
//
// O QUE ISTO PROVA: a página pede permissão, abre a câmera, lê as configurações aplicadas,
// mede frames apresentados, classifica os alvos e exporta o relatório com o schema correto.
// O QUE ISTO NÃO PROVA: nada sobre o iPhone 17 nem sobre 4K/60 reais.
// Verificações feitas (valem para qualquer câmera, inclusive a falsa):
//   - "Confirmado" só aparece com resolução aplicada = alvo, frames renderizados = alvo e FPS medido >= 90% do pedido;
//   - nenhum alvo pode ser confirmado com FPS acima do frameRate máximo que a própria câmera reporta;
//   - o relatório exportado respeita o schema icam.compatibility.v1.
//
// Uso (a partir da raiz do repositório):
//   CHROME_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/camera/e2e-chromium.mjs
import { spawn } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const pwaDir = join(here, '..', '..', 'apps', 'mobile-pwa');
const require = createRequire(join(pwaDir, 'package.json'));
const { chromium } = require('playwright-core');

const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}/`;
const CHROME = process.env.CHROME_PATH; // opcional: usa o Chrome já instalado

function fail(msg) {
  console.error(`FALHA: ${msg}`);
  process.exitCode = 1;
}
function ok(msg) {
  console.log(`ok: ${msg}`);
}

async function waitForHttp(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`servidor não respondeu em ${url}`);
}

const viteBin = join(here, '..', '..', 'node_modules', '.bin', 'vite');
const preview = spawn(viteBin, ['preview', '--port', String(PORT), '--strictPort'], {
  cwd: pwaDir,
  stdio: ['ignore', 'pipe', 'pipe'],
});
preview.stderr.on('data', () => {});

let browser;
try {
  await waitForHttp(BASE);
  browser = await chromium.launch({
    headless: true,
    executablePath: CHROME || undefined,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  const context = await browser.newContext({ permissions: ['camera'], viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(e.message));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  ok('página carregou');

  // 1) Captura: abrir a câmera e ler a configuração aplicada.
  await page.getByRole('button', { name: 'Iniciar câmera' }).click();
  await page.waitForFunction(() => {
    const dd = [...document.querySelectorAll('dd')].map((d) => d.textContent);
    return dd.some((t) => /\d+ × \d+/.test(t ?? ''));
  }, null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const liveFps = await page.evaluate(() => {
    const dt = [...document.querySelectorAll('dt')].find((d) => d.textContent === 'FPS medido agora');
    return dt?.nextElementSibling?.textContent ?? null;
  });
  if (!liveFps || liveFps === '—') fail('FPS medido ao vivo não apareceu');
  else ok(`FPS medido ao vivo: ${liveFps}`);

  const applied = await page.evaluate(() => {
    const dt = [...document.querySelectorAll('dt')].find((d) => d.textContent === 'Resolução aplicada');
    return dt?.nextElementSibling?.textContent ?? '';
  });
  const isFourK = /^3840 × 2160$/.test(applied);
  const banners = await page.locator('.banner').allTextContents();
  const expected = isFourK ? /4K confirmado|FPS medido/ : /Não é 4K/;
  if (!banners.some((b) => expected.test(b))) fail(`aviso de 4K inconsistente com "${applied}": ${banners.join(' | ')}`);
  else ok(`resolução aplicada "${applied}" e aviso coerente`);

  await page.getByRole('button', { name: 'Parar' }).click();
  ok('captura parada');

  // 2) Diagnóstico completo.
  await page.getByRole('button', { name: 'Diagnóstico' }).click();
  await page.getByRole('button', { name: 'Executar diagnóstico' }).click();
  await page.waitForFunction(() => document.body.textContent.includes('Resultados medidos'), null, { timeout: 240000 });
  ok('matriz concluída');

  const rows = await page.locator('table tbody tr').evaluateAll((trs) =>
    trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent?.trim() ?? '')),
  );
  if (rows.length !== 5) fail(`esperava 5 linhas na matriz, veio ${rows.length}`);
  ok(`linhas: ${rows.map((r) => `${r[0]}=${r[1]}`).join(' | ')}`);

  // 3) Exportar relatório e validar o schema.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar relatório (JSON)' }).click(),
  ]);
  const dir = await mkdtemp(join(tmpdir(), 'icam-e2e-'));
  const file = join(dir, 'relatorio.json');
  await download.saveAs(file);
  const report = JSON.parse(await readFile(file, 'utf8'));
  if (report.schema !== 'icam.compatibility.v1') fail(`schema inesperado: ${report.schema}`);
  if (!Array.isArray(report.matrix) || report.matrix.length !== 5) fail('matriz ausente no relatório');
  if (!report.limitations?.length) fail('limitações ausentes no relatório');
  const deviceMaxFps = report.capabilities?.frameRate?.max;
  for (const r of report.matrix ?? []) {
    const { target, verdict, applied, renderedWidth, renderedHeight, measuredFps } = r;
    if (verdict === 'accepted') {
      const sizeOk = applied.width === target.width && applied.height === target.height;
      const renderOk = renderedWidth === target.width && renderedHeight === target.height;
      const fpsOk = measuredFps >= target.fps * 0.9;
      if (!(sizeOk && renderOk && fpsOk)) fail(`${target.label} confirmado sem cumprir os critérios: ${JSON.stringify(r)}`);
    }
    if (verdict === 'accepted' && deviceMaxFps !== undefined && target.fps > deviceMaxFps) {
      fail(`${target.label} confirmado acima do frameRate máximo reportado (${deviceMaxFps})`);
    }
    if (r.fpsMethod !== 'requestVideoFrameCallback' && r.fpsMethod !== 'raf-estimate' && r.fpsMethod !== undefined) {
      fail(`método de FPS inesperado: ${r.fpsMethod}`);
    }
  }
  ok(`invariantes do classificador verificadas em ${report.matrix.length} alvos (frameRate máx. reportado: ${deviceMaxFps})`);
  ok(`relatório exportado e válido: ${file}`);

  if (consoleErrors.length) fail(`erros de página: ${consoleErrors.join(' | ')}`);
  else ok('nenhum erro de página');
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
} finally {
  await browser?.close();
  preview.kill('SIGTERM');
  process.exit(process.exitCode ?? 0);
}

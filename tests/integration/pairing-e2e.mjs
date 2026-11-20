// Fluxo completo do pareamento contra o servidor Go REAL e o PWA servido por ele (HTTPS).
// Simula o iPhone abrindo o link do QR (#pair=...). Não testa câmera: só o pareamento.
// Pré-requisitos: servidor em 127.0.0.1:8080 (local) e 127.0.0.1:8443 (HTTPS), com certs gerados.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(join(root, 'package.json'));
const { chromium } = require('playwright-core');

const LOCAL = 'http://127.0.0.1:8080';
const PUBLIC = 'https://127.0.0.1:8443';
const CHROME = process.env.CHROME_PATH;
let failed = false;
const fail = (m) => { failed = true; console.error(`FALHA: ${m}`); };
const ok = (m) => console.log(`ok: ${m}`);

// 1) Desktop cria a sessão (API local).
const created = await (await fetch(`${LOCAL}/api/sessions`, { method: 'POST' })).json();
ok(`sessão criada pelo Desktop: ${created.sessionId.slice(0, 8)}…`);

// --ignore-certificate-errors: SOMENTE neste teste, para o service worker registrar com a CA de teste.
// No iPhone real, a CA local precisa estar instalada e com confiança total (docs/SECURITY.md).
const browser = await chromium.launch({
  headless: true,
  executablePath: CHROME || undefined,
  args: ['--no-sandbox', '--ignore-certificate-errors'],
});
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // 2) iPhone abre o link do QR. O código está no fragmento: não vai ao servidor.
  await page.goto(`${PUBLIC}/#pair=${created.sessionId}.${created.pairingCode}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Parear' }).waitFor({ timeout: 10000 });
  const prefilled = await page.locator('input').first().inputValue();
  if (prefilled !== created.sessionId) fail('campo de sessão não foi preenchido a partir do fragmento');
  else ok('link do QR preencheu sessão e código automaticamente');

  // 3) Código errado primeiro: deve informar tentativas restantes.
  await page.locator('input').nth(1).fill('000000');
  if (created.pairingCode === '000000') await page.locator('input').nth(1).fill('111111');
  await page.getByRole('button', { name: 'Parear' }).click();
  const wrongText = await page.locator('.banner.err').textContent({ timeout: 10000 });
  if (!/Tentativas restantes: 4/.test(wrongText ?? '')) fail(`mensagem de erro sem tentativas: ${wrongText}`);
  else ok('código errado recusado, com "Tentativas restantes: 4"');

  // 4) Código certo.
  await page.locator('input').nth(1).fill(created.pairingCode);
  await page.getByRole('button', { name: 'Parear' }).click();
  await page.locator('.banner.ok').waitFor({ timeout: 10000 });
  ok('pareamento aceito pelo servidor');

  // 5) Desktop vê o estado "paired".
  const status = await (await fetch(`${LOCAL}/api/sessions/${created.sessionId}/status`)).json();
  if (status.state !== 'paired') fail(`estado no Desktop: ${status.state}`);
  else ok('Desktop recebeu estado "paired"');

  // 6) Código não pode ser reutilizado (uso único).
  // Feito de dentro da página (como o iPhone faria). O Node não confia na CA autoassinada deste teste.
  const again = await page.evaluate(async ({ sessionId, code }) => {
    const r = await fetch('/api/pair', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, code }),
    });
    return r.status;
  }, { sessionId: created.sessionId, code: created.pairingCode });
  if (again !== 409) fail(`reuso deveria ser 409, veio ${again}`);
  else ok('reuso do código recusado (409)');

  if (errors.length) fail(`erros de página: ${errors.join(' | ')}`);
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
} finally {
  await browser.close();
  process.exit(failed ? 1 : 0);
}

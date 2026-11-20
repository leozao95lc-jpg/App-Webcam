// Teste de integração do app Desktop (Electron) contra o servidor de sinalização REAL.
// Pré-requisitos: `npm run build` em desktop/ e o servidor rodando em 127.0.0.1:8080.
// Execução sem monitor (Linux de CI/ambiente): xvfb-run -a node tests/integration/electron-smoke.mjs
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const desktopDir = join(root, 'desktop');
const require = createRequire(join(root, 'package.json'));
const { _electron: electron } = require('playwright-core');

const shotDir = join(process.env.TMPDIR ?? '/tmp', 'icam-electron-shots');
mkdirSync(shotDir, { recursive: true });

let failed = false;
const fail = (m) => { failed = true; console.error(`FALHA: ${m}`); };
const ok = (m) => console.log(`ok: ${m}`);

const app = await electron.launch({
  args: [desktopDir, '--no-sandbox', '--disable-gpu'],
  cwd: desktopDir,
  env: { ...process.env, NODE_ENV: 'production' },
  timeout: 60000,
});

try {
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');
  ok('janela do Electron abriu');

  // Isolamento: a página não pode acessar Node nem o ipcRenderer cru.
  const isolated = await win.evaluate(() => ({
    hasRequire: typeof require !== 'undefined',
    hasProcess: typeof process !== 'undefined',
    hasIcam: typeof window.icam === 'object',
    hasRawIpc: typeof window.ipcRenderer !== 'undefined',
  }));
  if (isolated.hasRequire || isolated.hasProcess || isolated.hasRawIpc) fail(`isolamento quebrado: ${JSON.stringify(isolated)}`);
  else if (!isolated.hasIcam) fail('API window.icam ausente');
  else ok('isolamento de contexto: sem require/process/ipcRenderer; API window.icam exposta');

  // Servidor detectado pelo processo principal (IPC -> HTTP local).
  await win.getByText('Servidor ativo').waitFor({ timeout: 15000 });
  ok('processo principal detectou o servidor local (IPC + HTTP)');

  // Criar sessão pela interface.
  await win.getByRole('button', { name: 'Criar sessão de pareamento' }).click();
  const code = win.locator('.code-big');
  await code.waitFor({ timeout: 10000 });
  const text = (await code.textContent()) ?? '';
  if (!/^\d{3} \d{3}$/.test(text.trim())) fail(`código exibido em formato inesperado: "${text}"`);
  else ok(`código de pareamento exibido: ${text.trim()}`);

  const qrSrc = await win.locator('.pair-qr img').getAttribute('src', { timeout: 10000 });
  if (!qrSrc?.startsWith('data:image/png')) fail('QR code não gerado');
  else ok('QR code gerado (data URL PNG)');

  const address = await win.locator('.pair-info code').first().textContent({ timeout: 5000 }).catch(() => null);
  if (!address?.startsWith('https://')) fail(`endereço do PWA ausente: ${address}`);
  else ok(`endereço do iPhone: ${address}`);

  await win.getByText('Aguardando o iPhone').waitFor({ timeout: 5000 });
  ok('estado "aguardando" exibido');

  await win.screenshot({ path: join(shotDir, 'desktop-pairing.png') });
  ok(`captura de tela: ${join(shotDir, 'desktop-pairing.png')}`);
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
} finally {
  await app.close();
  process.exit(failed ? 1 : 0);
}

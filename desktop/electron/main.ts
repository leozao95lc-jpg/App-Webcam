import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import type { SessionCreated, SessionStatus } from '@icam/shared-types';
import { SignalingClient } from './serverClient';
import { lanIPv4Addresses } from './lan';
import { loadSettings, saveSettings, type DesktopSettings } from './settings';
import { IPC } from './ipcChannels';

const isDev = !app.isPackaged && process.env.ICAM_RENDERER_URL !== undefined;

/** Sessão criada para exibir o QR code. pairUrl só existe se houver IPv4 da LAN. */
interface DesktopSession extends SessionCreated {
  pairUrl: string;
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#0b0e13',
    title: 'iCam Studio 4K',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  // Nenhuma navegação para fora do app. Links externos abrem no navegador do sistema.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file:') && !url.startsWith(process.env.ICAM_RENDERER_URL ?? '\u0000')) {
      event.preventDefault();
    }
  });

  if (isDev && process.env.ICAM_RENDERER_URL) {
    void win.loadURL(process.env.ICAM_RENDERER_URL);
  } else {
    void win.loadFile(join(__dirname, '..', 'dist-renderer', 'index.html'));
  }
}

function client(settings: DesktopSettings): SignalingClient {
  return new SignalingClient(`http://127.0.0.1:${settings.localPort}`);
}

function registerIpc(): void {
  ipcMain.handle(IPC.getSettings, () => loadSettings());
  ipcMain.handle(IPC.saveSettings, (_e, partial: Partial<DesktopSettings>) => saveSettings(partial));
  ipcMain.handle(IPC.lanAddresses, () => lanIPv4Addresses());
  ipcMain.handle(IPC.serverHealth, async () => client(await loadSettings()).health());
  ipcMain.handle(IPC.createSession, async (): Promise<DesktopSession> => {
    const settings = await loadSettings();
    const created = await client(settings).createSession();
    const lan = settings.lanAddress || lanIPv4Addresses()[0] || '';
    const pairUrl = lan ? `https://${lan}:${settings.publicPort}/#pair=${created.sessionId}.${created.pairingCode}` : '';
    return { ...created, pairUrl };
  });
  ipcMain.handle(IPC.sessionStatus, async (_e, sessionId: string): Promise<SessionStatus> => {
    return client(await loadSettings()).sessionStatus(sessionId);
  });
  ipcMain.handle(IPC.openLocalPreview, async () => {
    const settings = await loadSettings();
    // Testa a câmera deste próprio PC pelo mesmo PWA. O Windows ainda não confia na CA local,
    // então o navegador mostrará alerta de certificado: é esperado nesta fase.
    await shell.openExternal(`https://127.0.0.1:${settings.publicPort}/`);
    return true;
  });
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

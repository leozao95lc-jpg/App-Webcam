import { contextBridge, ipcRenderer } from 'electron';

// Preload com sandbox não pode importar arquivos locais: as constantes IPC ficam duplicadas aqui.
// Mantenha em sincronia com electron/ipcChannels.ts (um teste de contrato cuida disso no futuro).
const IPC = {
  getSettings: 'settings:get',
  saveSettings: 'settings:save',
  lanAddresses: 'network:lan-addresses',
  serverHealth: 'server:health',
  createSession: 'session:create',
  sessionStatus: 'session:status',
  openLocalPreview: 'shell:open-local-preview',
} as const;

/**
 * Única ponte entre a interface e o processo principal. Expõe métodos nomeados,
 * nunca ipcRenderer cru: a interface não consegue enviar mensagens arbitrárias.
 */
const api = {
  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  saveSettings: (partial: Record<string, unknown>) => ipcRenderer.invoke(IPC.saveSettings, partial),
  lanAddresses: (): Promise<string[]> => ipcRenderer.invoke(IPC.lanAddresses),
  serverHealth: (): Promise<{ ok: boolean; detail?: string }> => ipcRenderer.invoke(IPC.serverHealth),
  createSession: (): Promise<{ sessionId: string; pairingCode: string; expiresAt: string; pairUrl: string }> =>
    ipcRenderer.invoke(IPC.createSession),
  sessionStatus: (sessionId: string) => ipcRenderer.invoke(IPC.sessionStatus, sessionId),
  openLocalPreview: (): Promise<boolean> => ipcRenderer.invoke(IPC.openLocalPreview),
};

contextBridge.exposeInMainWorld('icam', api);

export type IcamApi = typeof api;

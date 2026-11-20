/** Nomes dos canais IPC. Compartilhados entre processo principal e preload por cópia controlada. */
export const IPC = {
  getSettings: 'settings:get',
  saveSettings: 'settings:save',
  lanAddresses: 'network:lan-addresses',
  serverHealth: 'server:health',
  createSession: 'session:create',
  sessionStatus: 'session:status',
  openLocalPreview: 'shell:open-local-preview',
} as const;

import { app } from 'electron';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

/** Configurações locais do Desktop. Nenhum segredo é guardado aqui. */
export interface DesktopSettings {
  /** Porta da API local do servidor (loopback). */
  localPort: number;
  /** Porta HTTPS que o iPhone acessa na rede. */
  publicPort: number;
  /** IPv4 da LAN escolhido para o QR code. Vazio = primeiro disponível. */
  lanAddress: string;
}

export const DEFAULT_SETTINGS: DesktopSettings = {
  localPort: 8080,
  publicPort: 8443,
  lanAddress: '',
};

/** Valida valores vindos do disco ou da interface. Porta fora da faixa cai para o padrão. */
export function sanitizeSettings(input: Partial<DesktopSettings>): DesktopSettings {
  const port = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isInteger(v) && v >= 1024 && v <= 65535 ? v : fallback;
  return {
    localPort: port(input.localPort, DEFAULT_SETTINGS.localPort),
    publicPort: port(input.publicPort, DEFAULT_SETTINGS.publicPort),
    lanAddress: typeof input.lanAddress === 'string' && /^[0-9.]{7,15}$/.test(input.lanAddress) ? input.lanAddress : '',
  };
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

export async function loadSettings(): Promise<DesktopSettings> {
  try {
    const raw = await fs.readFile(settingsPath(), 'utf8');
    return sanitizeSettings(JSON.parse(raw) as Partial<DesktopSettings>);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(next: Partial<DesktopSettings>): Promise<DesktopSettings> {
  const merged = sanitizeSettings({ ...(await loadSettings()), ...next });
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

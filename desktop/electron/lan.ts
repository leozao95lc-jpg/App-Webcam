import { networkInterfaces } from 'node:os';

/** IPv4 não-loopback e não-link-local, para o iPhone alcançar pelo Wi-Fi. */
export function lanIPv4Addresses(): string[] {
  const out: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const addr of list ?? []) {
      if (addr.family === 'IPv4' && !addr.internal && !addr.address.startsWith('169.254.')) {
        out.push(addr.address);
      }
    }
  }
  return out;
}

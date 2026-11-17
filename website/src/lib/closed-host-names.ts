/**
 * Hosts antigos do Brand System, fechados ao público (ADR 0008).
 *
 * Fica fora de `closed-host.ts` (que importa `next/server`) para poder ser
 * lido também por componentes de cliente.
 */
export const CLOSED_HOSTS = new Set(["overlens-os.vercel.app"]);

export function isClosedHostname(hostname: string): boolean {
  return CLOSED_HOSTS.has(hostname.toLowerCase());
}

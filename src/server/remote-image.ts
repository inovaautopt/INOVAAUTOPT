import "server-only";
import { lookup } from "node:dns/promises";
import net from "node:net";

/**
 * Descarga de imagens por URL (importação CSV / importação de fotografias próprias publicadas
 * noutro canal). Proteções contra SSRF:
 *  - só https, porta 443, sem credenciais no URL;
 *  - só domínios autorizados (IMAGE_IMPORT_ALLOWED_HOSTS);
 *  - o nome é resolvido e TODOS os endereços têm de ser públicos (sem redes privadas,
 *    loopback, link-local, metadados de cloud, etc.);
 *  - sem seguir redirecionamentos automaticamente (cada salto é revalidado, máx. 3);
 *  - limite de tamanho e de tempo.
 * Só usar para conteúdos que a empresa tem direito a usar.
 */
const DEFAULT_ALLOWED = ["*.cdninstagram.com", "*.fbcdn.net"];
const MAX_BYTES = 12 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

export class RemoteImageError extends Error {}

export function allowedHosts(): string[] {
  const raw = process.env.IMAGE_IMPORT_ALLOWED_HOSTS;
  return raw ? raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) : DEFAULT_ALLOWED;
}

export function hostAllowed(host: string, patterns = allowedHosts()): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  return patterns.some((p) => (p.startsWith("*.") ? h.endsWith(p.slice(1)) && h.length > p.length - 1 : h === p));
}

export function isPublicAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 169 && b === 254) return false; // link-local / metadados cloud
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
    if (a >= 224) return false; // multicast / reservado
    if (a === 192 && b === 0) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    return true;
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return false;
    if (v.startsWith("fc") || v.startsWith("fd")) return false; // ULA
    if (v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb")) return false;
    if (v.startsWith("::ffff:")) return isPublicAddress(v.slice(7));
    return true;
  }
  return false;
}

export async function validateRemoteUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new RemoteImageError("URL inválido.");
  }
  if (url.protocol !== "https:") throw new RemoteImageError("Só são aceites URLs https.");
  if (url.username || url.password) throw new RemoteImageError("URL com credenciais não é aceite.");
  if (url.port && url.port !== "443") throw new RemoteImageError("Porta não permitida.");
  if (net.isIP(url.hostname)) throw new RemoteImageError("Usa um nome de domínio, não um endereço IP.");
  if (!hostAllowed(url.hostname)) throw new RemoteImageError(`Domínio não autorizado: ${url.hostname}.`);
  const addrs = await lookup(url.hostname, { all: true }).catch(() => []);
  if (addrs.length === 0) throw new RemoteImageError("Não foi possível resolver o domínio.");
  if (addrs.some((a) => !isPublicAddress(a.address))) throw new RemoteImageError("O domínio aponta para uma rede não pública.");
  return url;
}

export async function fetchRemoteImage(raw: string, hops = 0): Promise<Buffer> {
  const url = await validateRemoteUrl(raw);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { redirect: "manual", signal: ctrl.signal, headers: { Accept: "image/*" } });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc || hops >= 3) throw new RemoteImageError("Demasiados redirecionamentos.");
      return fetchRemoteImage(new URL(loc, url).toString(), hops + 1);
    }
    if (!res.ok) throw new RemoteImageError(`O servidor respondeu ${res.status}.`);
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) throw new RemoteImageError("O URL não devolveu uma imagem.");
    const len = Number(res.headers.get("content-length") ?? "0");
    if (len > MAX_BYTES) throw new RemoteImageError("Imagem demasiado grande.");
    const reader = res.body?.getReader();
    if (!reader) throw new RemoteImageError("Resposta vazia.");
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        ctrl.abort();
        throw new RemoteImageError("Imagem demasiado grande.");
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } catch (err) {
    if (err instanceof RemoteImageError) throw err;
    throw new RemoteImageError(ctrl.signal.aborted ? "Tempo esgotado ao descarregar a imagem." : "Falha ao descarregar a imagem.");
  } finally {
    clearTimeout(timer);
  }
}

import "server-only";
import { createHash } from "node:crypto";
import { asSystem } from "@/lib/db";
import { env } from "@/lib/env";

/** IP do visitante (Vercel define x-forwarded-for). Só é guardado em hash para limitar pedidos. */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "0.0.0.0";
}

export function hashIdentifier(value: string): string {
  const salt = env().RATE_LIMIT_SALT ?? "dev-salt-not-for-production";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 32);
}

/**
 * Limitação de pedidos partilhada (na base de dados), adequada a funções serverless.
 * Devolve true se o pedido pode prosseguir.
 */
export async function rateLimit(scope: string, identifier: string, max: number, windowSeconds: number): Promise<boolean> {
  const bucket = `${scope}:${hashIdentifier(identifier)}`;
  return asSystem(async (tx) => {
    const [row] = (await tx`select app.hit_rate_limit(${bucket}, ${windowSeconds}, ${max}) as ok`) as unknown as [{ ok: boolean }];
    return Boolean(row?.ok);
  });
}

/**
 * Sinais simples de automatismo: honeypot preenchido ou formulário enviado demasiado depressa.
 * Não bloqueia pessoas reais que demorem; só rejeita envios em menos de 2 segundos.
 */
export function looksAutomated(input: { website?: string; startedAt?: number }): boolean {
  if (input.website && input.website.length > 0) return true;
  if (input.startedAt && Date.now() - input.startedAt < 2000) return true;
  return false;
}

/** Só aceita pedidos que vêm do próprio site (proteção CSRF para endpoints com cookies). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") === "same-origin";
  try {
    const expected = new URL(env().NEXT_PUBLIC_SITE_URL);
    const got = new URL(origin);
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return got.host === expected.host || (host !== null && got.host === host);
  } catch {
    return false;
  }
}

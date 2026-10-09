import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import { asStaff, type StaffClaims, type Tx } from "@/lib/db";
import type { StaffRole } from "@/lib/domain";

/**
 * Autenticação dos colaboradores.
 *  - Produção: Supabase Auth (email + palavra-passe, recuperação por email, MFA TOTP).
 *    A identidade vem de getClaims(), que VERIFICA a assinatura do JWT.
 *  - Desenvolvimento local: AUTH_PROVIDER=dev (cookie assinado HMAC). A configuração
 *    recusa este modo em produção (src/lib/env.ts).
 * Não existe inscrição pública: só entra quem tem perfil ativo em app.profiles.
 */

export interface StaffProfile {
  id: string;
  fullName: string;
  email: string;
  role: StaffRole;
  isActive: boolean;
}

export interface Session {
  claims: StaffClaims;
  profile: StaffProfile | null;
}

const DEV_COOKIE = "inova_dev_session";

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(env().NEXT_PUBLIC_SUPABASE_URL!, env().NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* chamado num Server Component: o proxy trata da renovação */
        }
      },
    },
  });
}

function sign(payload: string) {
  return createHmac("sha256", env().DEV_AUTH_SECRET!).update(payload).digest("base64url");
}

export async function createDevSession(sub: string, email: string) {
  if (env().AUTH_PROVIDER !== "dev") throw new Error("Sessão de desenvolvimento indisponível.");
  const payload = Buffer.from(JSON.stringify({ sub, email, aal: "aal2", exp: Date.now() + 8 * 3600_000 })).toString("base64url");
  const store = await cookies();
  store.set(DEV_COOKIE, `${payload}.${sign(payload)}`, { httpOnly: true, sameSite: "lax", secure: false, path: "/", maxAge: 8 * 3600 });
}

async function readDevClaims(): Promise<StaffClaims | null> {
  const raw = (await cookies()).get(DEV_COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const got = Buffer.from(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { sub: string; email: string; aal: "aal2"; exp: number };
  if (data.exp < Date.now()) return null;
  return { sub: data.sub, email: data.email, aal: data.aal };
}

async function readClaims(): Promise<StaffClaims | null> {
  if (env().AUTH_PROVIDER === "dev") return readDevClaims();
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const c = data.claims as { sub: string; email?: string; aal?: string; session_id?: string };
  return { sub: c.sub, email: c.email, aal: c.aal === "aal2" ? "aal2" : "aal1", sessionId: c.session_id };
}

export const getSession = cache(async (): Promise<Session | null> => {
  const claims = await readClaims();
  if (!claims) return null;
  const profile = await asStaff(claims, async (tx) => {
    const [p] = (await tx`select id, full_name, email, role, is_active from app.profiles where id = ${claims.sub}`) as unknown as StaffProfile[];
    return p ?? null;
  });
  return { claims, profile };
});

/** MFA é obrigatória para administradores (perfis privilegiados). */
export function needsMfa(s: Session) {
  return s.profile?.role === "admin" && s.claims.aal !== "aal2";
}

/** Para páginas do painel: garante sessão, perfil ativo, MFA quando exigida e papel permitido. */
export async function requireStaff(roles?: StaffRole[]): Promise<Session & { profile: StaffProfile }> {
  const s = await getSession();
  if (!s) redirect("/admin/entrar");
  if (!s.profile || !s.profile.isActive) redirect("/admin/entrar?erro=sem-acesso");
  if (needsMfa(s)) redirect("/admin/mfa");
  if (roles && !roles.includes(s.profile.role)) redirect("/admin?erro=sem-permissao");
  return s as Session & { profile: StaffProfile };
}

/** Para server actions e endpoints: devolve null em vez de redirecionar. */
export async function staffOrNull(roles?: StaffRole[]): Promise<(Session & { profile: StaffProfile }) | null> {
  const s = await getSession();
  if (!s?.profile?.isActive || needsMfa(s)) return null;
  if (roles && !roles.includes(s.profile.role)) return null;
  return s as Session & { profile: StaffProfile };
}

/** Executa com as permissões (RLS) do colaborador autenticado. */
export async function withStaff<T>(roles: StaffRole[] | undefined, fn: (tx: Tx, s: Session & { profile: StaffProfile }) => Promise<T>): Promise<T> {
  const s = await staffOrNull(roles);
  if (!s) throw new AuthError();
  return asStaff(s.claims, (tx) => fn(tx, s));
}

export class AuthError extends Error {
  constructor(message = "Sessão expirada ou sem permissão. Volta a entrar.") {
    super(message);
  }
}

export async function signOut() {
  if (env().AUTH_PROVIDER === "dev") {
    (await cookies()).delete(DEV_COOKIE);
    return;
  }
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
}

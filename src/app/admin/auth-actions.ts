"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { env } from "@/lib/env";
import { asSystem } from "@/lib/db";
import { createDevSession, getSession, signOut, supabaseServer } from "@/server/auth";
import { clientIp, rateLimit } from "@/server/abuse";
import type { ActionState } from "@/components/admin/ActionForm";

const GENERIC_LOGIN_ERROR = "Email ou palavra-passe incorretos, ou acesso não autorizado.";

export async function loginAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const ip = clientIp(await headers());
  if (!(await rateLimit("login_ip", ip, 20, 900)) || !(await rateLimit("login_email", email, 8, 900))) {
    return { ok: false, message: "Demasiadas tentativas. Espera 15 minutos e tenta novamente." };
  }
  if (!z.email().safeParse(email).success) return { ok: false, fields: { email: "Indica um email válido." } };

  if (env().AUTH_PROVIDER === "dev") {
    // Só desenvolvimento local: entra com qualquer perfil ativo existente (sem palavra-passe).
    const [p] = (await asSystem((tx) => tx`select id, email from app.profiles where lower(email) = ${email} and is_active`)) as unknown as { id: string; email: string }[];
    if (!p) return { ok: false, message: GENERIC_LOGIN_ERROR };
    await createDevSession(p.id, p.email);
    redirect("/admin");
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, message: GENERIC_LOGIN_ERROR };
  const s = await getSession();
  if (!s?.profile?.isActive) {
    await supabase.auth.signOut();
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }
  if (s.profile.role === "admin") redirect("/admin/mfa");
  redirect("/admin");
}

export async function logoutAction() {
  await signOut();
  redirect("/admin/entrar");
}

export async function requestResetAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const ip = clientIp(await headers());
  if (!(await rateLimit("reset_ip", ip, 5, 3600))) return { ok: false, message: "Demasiados pedidos. Tenta mais tarde." };
  if (z.email().safeParse(email).success && env().AUTH_PROVIDER === "supabase") {
    const supabase = await supabaseServer();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: new URL("/admin/auth/callback?next=/admin/nova-palavra-passe", env().NEXT_PUBLIC_SITE_URL).toString(),
    });
  }
  // Resposta igual exista ou não a conta (não revela emails registados)
  return { ok: true, message: "Se o email pertencer a um colaborador, vais receber uma ligação para definir nova palavra-passe." };
}

export async function setPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (password.length < 12) return { ok: false, fields: { password: "Usa pelo menos 12 caracteres." } };
  if (password !== confirm) return { ok: false, fields: { confirm: "As palavras-passe não coincidem." } };
  if (env().AUTH_PROVIDER !== "supabase") return { ok: false, message: "Indisponível em modo de desenvolvimento." };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, message: "Não foi possível alterar a palavra-passe. Pede uma nova ligação." };
  redirect("/admin");
}

// ---------------------------------------------------------------------------
// MFA (TOTP) — obrigatório para administradores
// ---------------------------------------------------------------------------
export async function startMfaEnrollAction(): Promise<{ factorId: string; qr: string; secret: string } | { error: string }> {
  const supabase = await supabaseServer();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  // Remove fatores TOTP não verificados de tentativas anteriores
  for (const f of factors?.all ?? []) {
    if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Painel ${new Date().toISOString().slice(0, 10)}` });
  if (error || !data) return { error: "Não foi possível iniciar a configuração. Tenta novamente." };
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyMfaAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const code = String(fd.get("code") ?? "").replace(/\s/g, "");
  const factorId = String(fd.get("factorId") ?? "");
  if (!/^\d{6}$/.test(code)) return { ok: false, fields: { code: "Indica o código de 6 dígitos." } };
  const ip = clientIp(await headers());
  if (!(await rateLimit("mfa", ip, 10, 900))) return { ok: false, message: "Demasiadas tentativas. Espera 15 minutos." };
  const supabase = await supabaseServer();
  const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
  if (cErr || !challenge) return { ok: false, message: "Não foi possível validar. Tenta novamente." };
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
  if (error) return { ok: false, fields: { code: "Código inválido ou expirado." } };
  redirect("/admin");
}

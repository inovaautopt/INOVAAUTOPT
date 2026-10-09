import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/server/auth";
import { env } from "@/lib/env";

const TYPES: EmailOtpType[] = ["invite", "recovery", "magiclink", "email", "signup", "email_change"];

/**
 * Ligações dos emails da Supabase Auth com token_hash (convite e recuperação). Os modelos de email
 * apontam para aqui: {{ .SiteURL }}/admin/auth/confirm?token_hash={{ .TokenHash }}&type=invite
 * Funciona em qualquer navegador (não depende do fluxo PKCE iniciado no mesmo navegador).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const fallbackNext = type === "invite" || type === "recovery" ? "/admin/nova-palavra-passe" : "/admin";
  const next = url.searchParams.get("next") ?? fallbackNext;
  const safeNext = next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin";
  if (tokenHash && type && TYPES.includes(type) && env().AUTH_PROVIDER === "supabase") {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(safeNext, env().NEXT_PUBLIC_SITE_URL));
  }
  return NextResponse.redirect(new URL("/admin/entrar?erro=ligacao", env().NEXT_PUBLIC_SITE_URL));
}

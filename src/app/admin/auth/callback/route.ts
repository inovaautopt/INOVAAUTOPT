import { NextResponse } from "next/server";
import { supabaseServer } from "@/server/auth";
import { env } from "@/lib/env";

/** Recebe a ligação de convite/recuperação da Supabase Auth (fluxo PKCE) e abre a sessão. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/admin";
  const safeNext = next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin";
  if (code && env().AUTH_PROVIDER === "supabase") {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, env().NEXT_PUBLIC_SITE_URL));
  }
  return NextResponse.redirect(new URL("/admin/entrar?erro=ligacao", env().NEXT_PUBLIC_SITE_URL));
}

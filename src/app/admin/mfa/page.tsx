import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { getSession, supabaseServer } from "@/server/auth";
import { MfaEnroll, MfaVerify } from "./MfaClient";

export const metadata: Metadata = { title: "Verificação em dois passos" };

/** Administradores têm de concluir a verificação em dois passos (TOTP) em cada sessão. */
export default async function MfaPage() {
  const s = await getSession();
  if (!s?.profile) redirect("/admin/entrar");
  if (env().AUTH_PROVIDER === "dev" || s.claims.aal === "aal2") redirect("/admin");
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.mfa.listFactors();
  const verified = (data?.totp ?? []).find((f) => f.status === "verified");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <h1 className="heading text-2xl">Verificação em dois passos</h1>
      <p className="mt-1 text-sm text-muted">Obrigatória para administradores.</p>
      <div className="panel mt-6 p-5">{verified ? <MfaVerify factorId={verified.id} /> : <MfaEnroll />}</div>
    </main>
  );
}

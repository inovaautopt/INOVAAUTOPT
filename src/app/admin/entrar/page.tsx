import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/brand/Logo";
import { ActionForm } from "@/components/admin/ActionForm";
import { loginAction } from "../auth-actions";
import { env } from "@/lib/env";
import { getSession, needsMfa } from "@/server/auth";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage(props: PageProps<"/admin/entrar">) {
  const s = await getSession().catch(() => null);
  if (s?.profile?.isActive) redirect(needsMfa(s) ? "/admin/mfa" : "/admin");
  const sp = await props.searchParams;
  const dev = env().AUTH_PROVIDER === "dev";
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <LogoMark className="h-14 w-14" />
      <h1 className="heading mt-5 text-2xl">Painel do stand</h1>
      <p className="mt-1 text-sm text-muted">Acesso reservado a colaboradores.</p>
      {sp.erro === "sem-acesso" && <p className="mt-4 rounded-[var(--radius-sm)] bg-danger-soft p-3 text-sm text-danger">A tua conta não tem acesso ativo ao painel.</p>}
      <div className="panel mt-6 p-5">
        <ActionForm action={loginAction} submitLabel="Entrar" pendingLabel="A entrar…" submitClassName="w-full">
          <div>
            <label htmlFor="email" className="field-label">
              Email
            </label>
            <input id="email" name="email" type="email" autoComplete="username" required className="input" />
          </div>
          {!dev && (
            <div>
              <label htmlFor="password" className="field-label">
                Palavra-passe
              </label>
              <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
            </div>
          )}
          {dev && <p className="rounded-[var(--radius-sm)] bg-plate-yellow/60 p-2 text-xs">Modo de desenvolvimento: entra com admin@demo.local, vendedor@demo.local ou stock@demo.local, sem palavra-passe.</p>}
        </ActionForm>
      </div>
      {!dev && (
        <Link href="/admin/recuperar" className="mt-4 text-sm font-semibold text-brand-ink underline-offset-2 hover:underline">
          Esqueci-me da palavra-passe
        </Link>
      )}
    </main>
  );
}

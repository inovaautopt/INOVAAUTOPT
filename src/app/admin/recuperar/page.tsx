import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/admin/ActionForm";
import { requestResetAction } from "../auth-actions";

export const metadata: Metadata = { title: "Recuperar acesso" };

export default function ResetPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="heading text-2xl">Recuperar acesso</h1>
      <p className="mt-1 text-sm text-muted">Enviamos uma ligação para definires nova palavra-passe.</p>
      <div className="panel mt-6 p-5">
        <ActionForm action={requestResetAction} submitLabel="Enviar ligação" submitClassName="w-full">
          <div>
            <label htmlFor="email" className="field-label">
              Email
            </label>
            <input id="email" name="email" type="email" autoComplete="username" required className="input" />
          </div>
        </ActionForm>
      </div>
      <Link href="/admin/entrar" className="mt-4 text-sm font-semibold text-brand-ink hover:underline">
        Voltar a entrar
      </Link>
    </main>
  );
}

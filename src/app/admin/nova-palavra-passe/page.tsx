import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActionForm, FieldMsg } from "@/components/admin/ActionForm";
import { setPasswordAction } from "../auth-actions";
import { getSession } from "@/server/auth";

export const metadata: Metadata = { title: "Nova palavra-passe" };

export default async function NewPasswordPage() {
  const s = await getSession();
  if (!s) redirect("/admin/entrar");
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="heading text-2xl">Definir palavra-passe</h1>
      <div className="panel mt-6 p-5">
        <ActionForm action={setPasswordAction} submitLabel="Guardar palavra-passe" submitClassName="w-full">
          <>
            <>
              <div>
                <label htmlFor="password" className="field-label">
                  Nova palavra-passe
                </label>
                <input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required className="input" />
                <p className="field-hint">Pelo menos 12 caracteres. Usa uma frase que não uses noutros sites.</p>
                <FieldMsg name="password" />
              </div>
              <div>
                <label htmlFor="confirm" className="field-label">
                  Repete a palavra-passe
                </label>
                <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="input" />
                <FieldMsg name="confirm" />
              </div>
            </>
          </>
        </ActionForm>
      </div>
    </main>
  );
}

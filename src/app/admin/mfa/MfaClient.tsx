"use client";
/* eslint-disable @next/next/no-img-element -- código QR em data URI gerado pela Supabase */
import { useState } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { startMfaEnrollAction, verifyMfaAction } from "../auth-actions";

function CodeField({ error }: { error?: string }) {
  return (
    <div>
      <label htmlFor="code" className="field-label">
        Código de 6 dígitos
      </label>
      <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required className="input num tracking-[0.3em]" />
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

export function MfaVerify({ factorId }: { factorId: string }) {
  return (
    <ActionForm action={verifyMfaAction} submitLabel="Verificar" submitClassName="w-full">
      {(st) => (
        <>
          <p className="text-sm">Abre a aplicação de autenticação (por exemplo Google Authenticator ou Microsoft Authenticator) e indica o código.</p>
          <input type="hidden" name="factorId" value={factorId} />
          <CodeField error={st.fields?.code} />
        </>
      )}
    </ActionForm>
  );
}

export function MfaEnroll() {
  const [data, setData] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!data) {
    return (
      <div className="space-y-3">
        <p className="text-sm">Para proteger o painel, configura uma aplicação de autenticação no telemóvel.</p>
        {error && <p className="field-error">{error}</p>}
        <button
          type="button"
          className="btn btn-primary w-full"
          onClick={async () => {
            const r = await startMfaEnrollAction();
            if ("error" in r) setError(r.error);
            else setData(r);
          }}
        >
          Configurar
        </button>
      </div>
    );
  }
  return (
    <ActionForm action={verifyMfaAction} submitLabel="Ativar e entrar" submitClassName="w-full">
      {(st) => (
        <>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>Na aplicação de autenticação, adiciona uma conta lendo este código QR.</li>
            <li>Indica o código de 6 dígitos que aparece.</li>
          </ol>
          <img src={data.qr} alt="Código QR para a aplicação de autenticação" width={200} height={200} className="mx-auto rounded bg-white p-2" />
          <p className="text-center text-xs text-muted">
            Sem câmara? Introduz a chave: <code className="break-all font-mono">{data.secret}</code>
          </p>
          <input type="hidden" name="factorId" value={data.factorId} />
          <CodeField error={st.fields?.code} />
        </>
      )}
    </ActionForm>
  );
}

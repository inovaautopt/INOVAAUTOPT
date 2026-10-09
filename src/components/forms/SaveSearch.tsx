"use client";
import { useState } from "react";
import { BellRing } from "lucide-react";
import Link from "next/link";

/** Alerta por email para novas viaturas com estes critérios (exige confirmação por email). */
export function SaveSearch({ criteria }: { criteria: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  if (!open) {
    return (
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-dashed border-line-strong p-4">
        <p className="text-sm">Não encontras o que procuras? Recebe um email quando entrar uma viatura com estes critérios.</p>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(true)}>
          <BellRing aria-hidden className="h-4 w-4" /> Criar alerta
        </button>
      </div>
    );
  }
  return (
    <form
      className="mt-10 space-y-3 rounded-[var(--radius-md)] border border-line bg-surface p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setStatus("sending");
        const res = await fetch("/api/saved-searches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: fd.get("email"), criteria, website: fd.get("website") ?? "" }),
        }).catch(() => null);
        const json = await res?.json().catch(() => null);
        if (res?.ok && json?.ok) {
          setStatus("done");
          setMessage(json.message);
        } else {
          setStatus("error");
          setMessage(json?.error?.message ?? "Não foi possível criar o alerta. Tenta novamente.");
        }
      }}
    >
      <label htmlFor="alert-email" className="field-label">
        Email para o alerta
      </label>
      <div aria-hidden className="absolute -left-[9999px]">
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id="alert-email" name="email" type="email" required autoComplete="email" className="input sm:max-w-sm" />
        <button className="btn btn-dark" disabled={status === "sending" || status === "done"}>
          {status === "sending" ? "A criar…" : "Criar alerta"}
        </button>
      </div>
      <p className="text-xs text-muted">
        Enviamos um email para confirmares. Podes cancelar o alerta em qualquer email. Ver{" "}
        <Link href="/privacidade" className="underline">
          privacidade
        </Link>
        .
      </p>
      {message && (
        <p role="status" className={status === "error" ? "field-error" : "text-sm font-semibold text-ok"}>
          {message}
        </p>
      )}
    </form>
  );
}

"use client";
import { CheckCircle2 } from "lucide-react";
import type { SubmitState } from "./useSubmit";

export function FormError({ state }: { state: SubmitState }) {
  if (state.status !== "error") return null;
  return (
    <p role="alert" className="rounded-[var(--radius-sm)] bg-danger-soft p-3 text-sm font-semibold text-danger">
      {state.message}
    </p>
  );
}

/** Confirma a RECEÇÃO do pedido (o que é verdade), sem prometer entrega de email. */
export function FormSuccess({ title, reference, children, onReset }: { title: string; reference: string; children?: React.ReactNode; onReset?: () => void }) {
  return (
    <div role="status" className="rounded-[var(--radius-md)] border border-ok/30 bg-ok-soft p-5">
      <p className="flex items-center gap-2 font-bold text-ok">
        <CheckCircle2 aria-hidden className="h-5 w-5" /> {title}
      </p>
      <p className="mt-2 text-sm">
        Número do pedido: <strong className="num">{reference}</strong>. {children}
      </p>
      {onReset && (
        <button type="button" onClick={onReset} className="mt-3 text-sm font-semibold underline">
          Enviar outro pedido
        </button>
      )}
    </div>
  );
}

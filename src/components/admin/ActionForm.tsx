"use client";
import { createContext, useActionState, useContext, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";

export interface ActionState {
  ok: boolean;
  message?: string;
  fields?: Record<string, string>;
  /** Incrementa a cada submissão para forçar re-render de mensagens repetidas */
  at?: number;
}

export const initialState: ActionState = { ok: false };
const StateContext = createContext<ActionState>(initialState);

function Submit({ label, pendingLabel, className, confirm }: { label: string; pendingLabel?: string; className?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={cn("btn btn-primary", className)}
      disabled={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? (pendingLabel ?? "A guardar…") : label}
    </button>
  );
}

/**
 * Formulário do painel ligado a uma server action. Mostra erros por campo e a mensagem
 * de resultado. Os campos usam name="..." e leem os erros por FieldError.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel,
  className,
  submitClassName,
  resetOnSuccess = false,
  confirm,
  footer,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode | ((state: ActionState) => React.ReactNode);
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  submitClassName?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
  footer?: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, initialState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={cn("space-y-4", className)} noValidate>
      <StateContext.Provider value={state}>{typeof children === "function" ? children(state) : children}</StateContext.Provider>
      {state.message && (
        <p role={state.ok ? "status" : "alert"} className={cn("rounded-[var(--radius-sm)] p-3 text-sm font-semibold", state.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger")}>
          {state.message}
        </p>
      )}
      {state.fields && Object.keys(state.fields).length > 0 && !state.message && (
        <p role="alert" className="text-sm font-semibold text-danger">
          Revê os campos assinalados.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Submit label={submitLabel} pendingLabel={pendingLabel} className={submitClassName} confirm={confirm} />
        {footer}
      </div>
    </form>
  );
}

export function FieldError({ state, name }: { state: ActionState; name: string }) {
  const msg = state.fields?.[name];
  if (!msg) return null;
  return <p className="field-error">{msg}</p>;
}

/** Erro de um campo, lido do estado do formulário envolvente (funciona em Server Components). */
export function FieldMsg({ name }: { name: string }) {
  const state = useContext(StateContext);
  const msg = state.fields?.[name];
  if (!msg) return null;
  return <p className="field-error">{msg}</p>;
}

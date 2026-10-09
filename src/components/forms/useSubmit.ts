"use client";
import { useRef, useState } from "react";
import { trackEvent } from "@/components/consent/Analytics";

export type SubmitState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "success"; reference: string }
  | { status: "error"; message: string; fields: Record<string, string> };

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));
}

/**
 * Envio de formulários públicos: chave de idempotência por tentativa (evita duplicados em
 * duplo clique ou reenvio), tempo de preenchimento (antiabuso) e erros associados aos campos.
 */
export function useSubmit(endpoint: string, formName: string) {
  const [state, setState] = useState<SubmitState>({ status: "idle" });
  const keyRef = useRef<string | null>(null);
  const [startedAt, setStartedAt] = useState(() => Date.now());

  async function submit(payload: Record<string, unknown>, files?: { name: string; files: File[] }) {
    if (state.status === "sending") return;
    if (!keyRef.current) keyRef.current = newKey();
    setState({ status: "sending" });
    const body = { ...payload, idempotencyKey: keyRef.current, startedAt, pageUrl: window.location.pathname };
    try {
      let res: Response;
      if (files) {
        const fd = new FormData();
        fd.set("data", JSON.stringify(body));
        files.files.forEach((f) => fd.append(files.name, f));
        res = await fetch(endpoint, { method: "POST", body: fd });
      } else {
        res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setState({ status: "success", reference: json.reference });
        keyRef.current = null;
        trackEvent("lead_submitted", { form: formName });
        return true;
      }
      setState({
        status: "error",
        message: json?.error?.message ?? "Não foi possível enviar. Verifica a ligação e tenta novamente.",
        fields: json?.error?.fields ?? {},
      });
    } catch {
      // Falha de rede: mantém a mesma chave para que um novo envio não crie um duplicado
      setState({ status: "error", message: "Sem ligação. Verifica a internet e tenta novamente — o pedido não será duplicado.", fields: {} });
    }
    return false;
  }

  function reset() {
    keyRef.current = null;
    setStartedAt(Date.now());
    setState({ status: "idle" });
  }

  return { state, submit, reset };
}

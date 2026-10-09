"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function Composer({ conversationId, windowOpen, templates }: { conversationId: string; windowOpen: boolean; templates: { key: string; label: string }[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [template, setTemplate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  return (
    <form
      className="panel mt-4 space-y-2 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        key.current ??= crypto.randomUUID();
        const res = await fetch("/api/admin/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, idempotencyKey: key.current, ...(windowOpen && text ? { text } : { templateKey: template }) }),
        }).catch(() => null);
        const json = await res?.json().catch(() => null);
        setBusy(false);
        if (res?.ok) {
          setText("");
          key.current = null;
          router.refresh();
        } else setError(json?.error?.message ?? "Sem ligação. Tenta novamente (não haverá duplicado).");
      }}
    >
      {windowOpen ? (
        <>
          <label htmlFor="wa-text" className="field-label">Resposta</label>
          <textarea id="wa-text" value={text} onChange={(e) => setText(e.target.value)} className="input min-h-20" maxLength={4096} />
        </>
      ) : templates.length ? (
        <>
          <label htmlFor="wa-tpl" className="field-label">Template aprovado</label>
          <select id="wa-tpl" value={template} onChange={(e) => setTemplate(e.target.value)} className="input">
            <option value="">Escolhe</option>
            {templates.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </>
      ) : (
        <p className="text-sm text-muted">Não há templates aprovados configurados (Integrações). Contacta o cliente por telefone ou email.</p>
      )}
      {error && <p role="alert" className="field-error">{error}</p>}
      <button className="btn btn-whatsapp" disabled={busy || (windowOpen ? !text.trim() : !template)}>{busy ? "A enviar…" : "Enviar"}</button>
    </form>
  );
}

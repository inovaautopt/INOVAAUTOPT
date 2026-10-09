"use client";
import Link from "next/link";
import { Field } from "./Field";

/** Campos de contacto comuns. Pede só o necessário: nome e pelo menos um contacto. */
export function ContactFields({ errors, whatsappAvailable }: { errors: Record<string, string>; whatsappAvailable: boolean }) {
  return (
    <>
      {/* Honeypot: invisível para pessoas, preenchido por robôs */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Não preencher
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Field label="Nome" name="name" error={errors.name}>
        {(p) => <input {...p} className="input" autoComplete="name" required maxLength={120} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Telefone" name="phone" error={errors.phone} hint="Números estrangeiros com indicativo, ex.: +44…">
          {(p) => <input {...p} className="input" type="tel" autoComplete="tel" inputMode="tel" maxLength={30} />}
        </Field>
        <Field label="Email" name="email" error={errors.email}>
          {(p) => <input {...p} className="input" type="email" autoComplete="email" maxLength={200} />}
        </Field>
      </div>
      <fieldset>
        <legend className="field-label">Como preferes que te contactemos?</legend>
        <div className="flex flex-wrap gap-2">
          {[
            { v: "phone", l: "Por telefone" },
            { v: "email", l: "Por email" },
            ...(whatsappAvailable ? [{ v: "whatsapp", l: "Por WhatsApp" }] : []),
          ].map((o) => (
            <label key={o.v} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
              <input type="radio" name="preferredChannel" value={o.v} className="check" />
              {o.l}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-2 text-sm">
        {whatsappAvailable && (
          <label className="flex gap-2">
            <input type="checkbox" name="allowWhatsapp" className="check" />
            <span>Autorizo que me respondam por WhatsApp para este pedido.</span>
          </label>
        )}
        <label className="flex gap-2">
          <input type="checkbox" name="allowMarketing" className="check" />
          <span>Quero receber novidades e promoções do stand (opcional, posso cancelar a qualquer momento).</span>
        </label>
      </div>
      <p className="text-xs leading-relaxed text-muted">
        Usamos os teus dados para responder a este pedido. Sabe mais na{" "}
        <Link href="/privacidade" className="underline">
          política de privacidade
        </Link>
        .
      </p>
    </>
  );
}

export function contactPayload(fd: FormData) {
  const get = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
  };
  return {
    name: get("name") ?? "",
    phone: get("phone"),
    email: get("email"),
    preferredChannel: get("preferredChannel"),
    allowWhatsapp: fd.get("allowWhatsapp") === "on",
    allowMarketing: fd.get("allowMarketing") === "on",
    website: (fd.get("website") as string) ?? "",
    message: get("message"),
  };
}

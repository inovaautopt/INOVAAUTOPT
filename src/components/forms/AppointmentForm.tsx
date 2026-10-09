"use client";
import { useState } from "react";
import { ContactFields, contactPayload } from "./ContactFields";
import { Field } from "./Field";
import { FormError, FormSuccess } from "./FormResult";
import { useSubmit } from "./useSubmit";

type Hours = Partial<Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", [string, string][]>>;
const KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function lisbonToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function AppointmentForm({
  vehicle,
  branches,
  whatsappAvailable,
}: {
  vehicle?: { id: string; reference: string; title: string };
  branches: { id: string; name: string; openingHours: Hours }[];
  whatsappAvailable: boolean;
}) {
  const { state, submit, reset } = useSubmit("/api/appointments", "appointment");
  const errors = state.status === "error" ? state.fields : {};
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [date, setDate] = useState("");
  const branch = branches.find((b) => b.id === branchId);
  const today = lisbonToday();
  const dayIntervals = date && branch ? branch.openingHours[KEYS[new Date(`${date}T12:00:00Z`).getUTCDay()]!] ?? [] : null;
  const closedDay = dayIntervals !== null && dayIntervals.length === 0;

  if (branches.length === 0) {
    return <p className="text-sm text-muted">As marcações online ficam disponíveis assim que o horário do stand estiver configurado. Até lá, contacta-nos por telefone ou WhatsApp.</p>;
  }

  if (state.status === "success") {
    return (
      <FormSuccess title="Pedido de marcação recebido" reference={state.reference} onReset={reset}>
        Ainda não é uma marcação confirmada: vamos contactar-te para acertar a hora.
      </FormSuccess>
    );
  }

  return (
    <form
      noValidate
      className="relative space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        void submit({
          ...contactPayload(fd),
          vehicleId: vehicle?.id,
          branchId,
          kind: fd.get("kind"),
          requestedDate: date,
          requestedPeriod: fd.get("requestedPeriod"),
        });
      }}
    >
      <fieldset>
        <legend className="field-label">O que pretendes?</legend>
        <div className="flex flex-wrap gap-2">
          {[
            { v: "visit", l: "Visitar o stand" },
            ...(vehicle ? [{ v: "test_drive", l: "Fazer test drive" }] : []),
          ].map((o, i) => (
            <label key={o.v} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
              <input type="radio" name="kind" value={o.v} defaultChecked={i === 0} className="check" />
              {o.l}
            </label>
          ))}
        </div>
      </fieldset>
      {branches.length > 1 && (
        <Field label="Instalação" name="branchId" error={errors.branchId}>
          {(p) => (
            <select {...p} className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Dia pretendido" name="requestedDate" error={errors.requestedDate ?? (closedDay ? "O stand está encerrado nesse dia." : undefined)}>
          {(p) => <input {...p} type="date" className="input" min={today} max={addDays(today, 60)} value={date} onChange={(e) => setDate(e.target.value)} required />}
        </Field>
        <fieldset>
          <legend className="field-label">Período</legend>
          <div className="flex gap-2">
            {[
              { v: "morning", l: "Manhã" },
              { v: "afternoon", l: "Tarde" },
            ].map((o, i) => (
              <label key={o.v} className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
                <input type="radio" name="requestedPeriod" value={o.v} defaultChecked={i === 0} className="sr-only" />
                {o.l}
              </label>
            ))}
          </div>
          {errors.requestedPeriod && <p className="field-error">{errors.requestedPeriod}</p>}
        </fieldset>
      </div>
      {dayIntervals && dayIntervals.length > 0 && <p className="text-sm text-muted num">Horário nesse dia: {dayIntervals.map(([a, b]) => `${a}–${b}`).join(", ")}</p>}
      <ContactFields errors={errors} whatsappAvailable={whatsappAvailable} />
      <Field label="Observações" name="message" error={errors.message} optional>
        {(p) => <textarea {...p} className="input min-h-20" maxLength={2000} />}
      </Field>
      <FormError state={state} />
      <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={state.status === "sending" || closedDay}>
        {state.status === "sending" ? "A enviar…" : "Pedir marcação"}
      </button>
      <p className="text-xs text-muted">O pedido fica sujeito a confirmação pelo stand.</p>
    </form>
  );
}

"use client";
import { ContactFields, contactPayload } from "./ContactFields";
import { Field } from "./Field";
import { FormError, FormSuccess } from "./FormResult";
import { useSubmit } from "./useSubmit";

export function LeadForm({
  vehicle,
  kind = "info",
  whatsappAvailable,
  defaultMessage,
  submitLabel = "Enviar pedido",
}: {
  vehicle?: { id: string; reference: string; title: string };
  kind?: "info" | "financing";
  whatsappAvailable: boolean;
  defaultMessage?: string;
  submitLabel?: string;
}) {
  const { state, submit, reset } = useSubmit("/api/leads", kind === "financing" ? "financing" : "lead");
  const errors = state.status === "error" ? state.fields : {};

  if (state.status === "success") {
    return (
      <FormSuccess title="Pedido recebido" reference={state.reference} onReset={reset}>
        Vamos responder-te pelo contacto que indicaste durante o horário do stand.
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
        void submit({ ...contactPayload(fd), kind, vehicleId: vehicle?.id });
      }}
    >
      <ContactFields errors={errors} whatsappAvailable={whatsappAvailable} />
      <Field label="Mensagem" name="message" error={errors.message} optional>
        {(p) => <textarea {...p} className="input" maxLength={4000} defaultValue={defaultMessage ?? (vehicle ? `Olá, tenho interesse na viatura ${vehicle.title}, referência ${vehicle.reference}. Está disponível?` : "")} />}
      </Field>
      <FormError state={state} />
      <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={state.status === "sending"}>
        {state.status === "sending" ? "A enviar…" : submitLabel}
      </button>
    </form>
  );
}

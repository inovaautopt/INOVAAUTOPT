"use client";
import { useState } from "react";
import { ContactFields, contactPayload } from "./ContactFields";
import { Field } from "./Field";
import { FormError, FormSuccess } from "./FormResult";
import { useSubmit } from "./useSubmit";
import { FUELS, FUEL_LABEL } from "@/lib/domain";

const MAX_FILES = 6;
const MAX_BYTES = 10 * 1024 * 1024;

export function TradeInForm({ vehicle, whatsappAvailable }: { vehicle?: { id: string; reference: string; title: string }; whatsappAvailable: boolean }) {
  const { state, submit, reset } = useSubmit("/api/trade-ins", "trade_in");
  const errors = state.status === "error" ? state.fields : {};
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const year = new Date().getFullYear();

  if (state.status === "success") {
    return (
      <FormSuccess title="Pedido de avaliação recebido" reference={state.reference} onReset={reset}>
        Vamos analisar a informação e contactar-te. A avaliação final depende de ver a viatura.
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
        void submit(
          {
            ...contactPayload(fd),
            vehicleId: vehicle?.id,
            make: fd.get("make"),
            model: fd.get("model"),
            year: fd.get("year"),
            mileageKm: String(fd.get("mileageKm") ?? "").replace(/\D/g, ""),
            fuel: fd.get("fuel"),
            condition: fd.get("condition") || undefined,
          },
          { name: "photos", files },
        );
      }}
    >
      <fieldset className="space-y-4">
        <legend className="heading text-lg">A tua viatura</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Marca" name="make" error={errors.make}>
            {(p) => <input {...p} className="input" required maxLength={60} />}
          </Field>
          <Field label="Modelo" name="model" error={errors.model}>
            {(p) => <input {...p} className="input" required maxLength={80} />}
          </Field>
          <Field label="Ano" name="year" error={errors.year}>
            {(p) => (
              <select {...p} className="input" required defaultValue="">
                <option value="" disabled>
                  Escolhe o ano
                </option>
                {Array.from({ length: 35 }, (_, i) => year - i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Quilómetros" name="mileageKm" error={errors.mileageKm}>
            {(p) => <input {...p} className="input num" inputMode="numeric" required maxLength={9} />}
          </Field>
          <Field label="Combustível" name="fuel" error={errors.fuel}>
            {(p) => (
              <select {...p} className="input" required defaultValue="">
                <option value="" disabled>
                  Escolhe
                </option>
                {FUELS.map((f) => (
                  <option key={f} value={f}>
                    {FUEL_LABEL[f]}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <Field label="Estado da viatura" name="condition" error={errors.condition} optional hint="Ex.: revisões em dia, riscos, avarias conhecidas, pneus.">
          {(p) => <textarea {...p} className="input min-h-24" maxLength={2000} />}
        </Field>
        <Field label="Fotografias" name="photos" error={errors.photos ?? fileError ?? undefined} optional hint={`Até ${MAX_FILES} fotografias (JPEG, PNG, WebP ou HEIC, máx. 10 MB cada). Não incluas documentos.`}>
          {(p) => (
            <input
              {...p}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              className="block w-full text-sm file:mr-3 file:rounded-[var(--radius-sm)] file:border-0 file:bg-ink file:px-3 file:py-2 file:font-semibold file:text-white"
              onChange={(e) => {
                const list = Array.from(e.target.files ?? []);
                if (list.length > MAX_FILES) {
                  setFileError(`Escolhe no máximo ${MAX_FILES} fotografias.`);
                  setFiles(list.slice(0, MAX_FILES));
                } else if (list.some((f) => f.size > MAX_BYTES)) {
                  setFileError("Uma das fotografias tem mais de 10 MB.");
                  setFiles(list.filter((f) => f.size <= MAX_BYTES));
                } else {
                  setFileError(null);
                  setFiles(list);
                }
              }}
            />
          )}
        </Field>
        {files.length > 0 && <p className="text-sm text-muted">{files.length} fotografia(s) selecionada(s)</p>}
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="heading text-lg">Os teus contactos</legend>
        <ContactFields errors={errors} whatsappAvailable={whatsappAvailable} />
      </fieldset>
      <FormError state={state} />
      <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={state.status === "sending"}>
        {state.status === "sending" ? "A enviar…" : "Pedir avaliação"}
      </button>
      <p className="text-xs text-muted">Isto é um pedido de avaliação: não inclui um preço automático nem garante a compra da viatura.</p>
    </form>
  );
}

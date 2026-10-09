"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { BODY_TYPES, BODY_TYPE_LABEL, DRIVETRAINS, DRIVETRAIN_LABEL, FUELS, FUEL_LABEL, TRANSMISSIONS, TRANSMISSION_LABEL } from "@/lib/domain";
import type { Facets } from "@/lib/vehicles";

const YEARS = (() => {
  const now = new Date().getFullYear();
  return Array.from({ length: 30 }, (_, i) => now - i);
})();

function useUrlUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("pagina");
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
  return { params, update, pending };
}

/** Campo numérico com debounce: só atualiza a pesquisa 600 ms depois de a pessoa parar de escrever. */
function NumberField({ name, label, placeholder, suffix }: { name: string; label: string; placeholder?: string; suffix?: string }) {
  const { params, update } = useUrlUpdater();
  const urlValue = params.get(name) ?? "";
  const [value, setValue] = useState(urlValue);
  const [synced, setSynced] = useState(urlValue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();
  if (urlValue !== synced) {
    setSynced(urlValue);
    setValue(urlValue);
  }
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold text-muted">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          inputMode="numeric"
          pattern="[0-9 ]*"
          className="input pr-10 num"
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d]/g, "");
            setValue(v);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => update({ [name]: v || null }), 600);
          }}
        />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{suffix}</span>}
      </div>
    </div>
  );
}

function CheckGroup<T extends string>({ name, legend, values, labels }: { name: string; legend: string; values: readonly T[]; labels: Record<T, string> }) {
  const { params, update } = useUrlUpdater();
  const selected = (params.get(name) ?? "").split(",").filter(Boolean);
  return (
    <fieldset>
      <legend className="field-label">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => {
          const on = selected.includes(v);
          return (
            <label key={v} className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border px-3 text-sm font-medium ${on ? "border-brand bg-brand-soft text-brand-ink" : "border-line-strong bg-surface"}`}>
              <input
                type="checkbox"
                className="sr-only"
                checked={on}
                onChange={() => {
                  const next = on ? selected.filter((x) => x !== v) : [...selected, v];
                  update({ [name]: next.join(",") || null });
                }}
              />
              {labels[v]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function SelectField({ name, label, children, disabled, onValue }: { name: string; label: string; children: React.ReactNode; disabled?: boolean; onValue?: (v: string) => Record<string, string | null> }) {
  const { params, update } = useUrlUpdater();
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <select id={id} className="input" value={params.get(name) ?? ""} disabled={disabled} onChange={(e) => update(onValue ? onValue(e.target.value) : { [name]: e.target.value || null })}>
        {children}
      </select>
    </div>
  );
}

function Filters({ facets }: { facets: Facets }) {
  const { params, update } = useUrlUpdater();
  const make = params.get("marca") ?? "";
  const selectedFeatures = (params.get("equipamento") ?? "").split(",").filter(Boolean);
  return (
    <div className="space-y-6">
      <SelectField name="marca" label="Marca" onValue={(v) => ({ marca: v || null, modelo: null })}>
        <option value="">Todas as marcas</option>
        {facets.makes.map((m) => (
          <option key={m.make} value={m.make}>
            {m.make} ({m.count})
          </option>
        ))}
      </SelectField>
      <SelectField name="modelo" label="Modelo" disabled={!make}>
        <option value="">{make ? "Todos os modelos" : "Escolhe a marca"}</option>
        {facets.models.map((m) => (
          <option key={m.model} value={m.model}>
            {m.model} ({m.count})
          </option>
        ))}
      </SelectField>

      <fieldset>
        <legend className="field-label">Preço</legend>
        <div className="grid grid-cols-2 gap-2">
          <NumberField name="precoMin" label="Mínimo" suffix="€" />
          <NumberField name="precoMax" label="Máximo" suffix="€" />
        </div>
      </fieldset>

      <fieldset>
        <legend className="field-label">Ano de primeira matrícula</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["anoMin", "anoMax"] as const).map((n) => (
            <div key={n}>
              <label className="text-xs font-semibold text-muted" htmlFor={`f-${n}`}>
                {n === "anoMin" ? "Desde" : "Até"}
              </label>
              <select id={`f-${n}`} className="input mt-1" value={params.get(n) ?? ""} onChange={(e) => update({ [n]: e.target.value || null })}>
                <option value="">Qualquer</option>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="field-label">Quilómetros</legend>
        <div className="grid grid-cols-2 gap-2">
          <NumberField name="kmMin" label="Mínimo" suffix="km" />
          <NumberField name="kmMax" label="Máximo" suffix="km" />
        </div>
      </fieldset>

      <CheckGroup name="combustivel" legend="Combustível" values={FUELS.filter((f) => f !== "other")} labels={FUEL_LABEL} />
      <CheckGroup name="caixa" legend="Caixa de velocidades" values={TRANSMISSIONS} labels={TRANSMISSION_LABEL} />
      <CheckGroup name="carrocaria" legend="Carroçaria" values={BODY_TYPES.filter((b) => b !== "other")} labels={BODY_TYPE_LABEL} />

      <fieldset>
        <legend className="field-label">Potência</legend>
        <div className="grid grid-cols-2 gap-2">
          <NumberField name="potenciaMin" label="Mínimo" suffix="cv" />
          <NumberField name="potenciaMax" label="Máximo" suffix="cv" />
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-2">
        <SelectField name="lugares" label="Lugares">
          <option value="">Qualquer</option>
          {[2, 4, 5, 7, 8, 9].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </SelectField>
        <SelectField name="portas" label="Portas">
          <option value="">Qualquer</option>
          {[2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </SelectField>
      </div>

      <CheckGroup name="tracao" legend="Tração" values={DRIVETRAINS} labels={DRIVETRAIN_LABEL} />

      {facets.colors.length > 0 && (
        <SelectField name="cor" label="Cor">
          <option value="">Qualquer cor</option>
          {facets.colors.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectField>
      )}

      {facets.branches.length > 1 && (
        <SelectField name="instalacao" label="Localização">
          <option value="">Todas</option>
          {facets.branches.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.name}
            </option>
          ))}
        </SelectField>
      )}

      {facets.features.length > 0 && (
        <fieldset>
          <legend className="field-label">Equipamento</legend>
          <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {facets.features.map((f) => {
              const on = selectedFeatures.includes(f.id);
              return (
                <label key={f.id} className="flex min-h-9 cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="check"
                    checked={on}
                    onChange={() => {
                      const next = on ? selectedFeatures.filter((x) => x !== f.id) : [...selectedFeatures, f.id];
                      update({ equipamento: next.join(",") || null });
                    }}
                  />
                  {f.name}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
    </div>
  );
}

export function FilterPanel({ facets, total, activeCount }: { facets: Facets; total: number; activeCount: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const { pending } = useUrlUpdater();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      {/* Telemóvel: janela de filtros acessível */}
      <div className="lg:hidden">
        <button type="button" className="btn btn-outline w-full" onClick={() => setOpen(true)} aria-haspopup="dialog">
          <SlidersHorizontal aria-hidden className="h-4 w-4" />
          Filtros{activeCount > 0 ? ` (${activeCount})` : ""}
        </button>
        <dialog ref={ref} onClose={() => setOpen(false)} aria-label="Filtros" className="m-0 h-dvh max-h-none w-full max-w-none bg-paper p-0 backdrop:bg-ink/50">
          <div className="flex h-full flex-col">
            <div className="flex h-14 flex-none items-center justify-between border-b border-line bg-surface px-4">
              <h2 className="heading text-lg">Filtros</h2>
              <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-chrome-hi" onClick={() => setOpen(false)} aria-label="Fechar filtros">
                <X aria-hidden className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <Filters facets={facets} />
            </div>
            <div className="flex-none border-t border-line bg-surface p-4">
              <button type="button" className="btn btn-primary w-full" onClick={() => setOpen(false)} aria-live="polite">
                {pending ? "A atualizar…" : `Mostrar ${total} ${total === 1 ? "viatura" : "viaturas"}`}
              </button>
            </div>
          </div>
        </dialog>
      </div>
      {/* Desktop: barra lateral */}
      <aside className="hidden lg:block" aria-label="Filtros">
        <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-[var(--radius-md)] border border-line bg-surface p-5">
          <Filters facets={facets} />
        </div>
      </aside>
    </>
  );
}

export function SortSelect({ value }: { value: string }) {
  const { update } = useUrlUpdater();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="ordem" className="whitespace-nowrap text-sm font-semibold">
        Ordenar
      </label>
      <select id="ordem" className="input min-h-10 py-1.5" value={value} onChange={(e) => update({ ordem: e.target.value === "recent" ? null : e.target.value })}>
        <option value="recent">Mais recentes</option>
        <option value="price_asc">Preço mais baixo</option>
        <option value="price_desc">Preço mais alto</option>
        <option value="km_asc">Menos quilómetros</option>
        <option value="year_desc">Ano mais recente</option>
      </select>
    </div>
  );
}

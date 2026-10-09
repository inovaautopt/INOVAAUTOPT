"use client";
import { useState } from "react";
import { ActionForm, type ActionState } from "./ActionForm";
import {
  BODY_TYPES,
  BODY_TYPE_LABEL,
  DRIVETRAINS,
  DRIVETRAIN_LABEL,
  FEATURE_GROUPS,
  FEATURE_GROUP_LABEL,
  FUELS,
  FUEL_LABEL,
  HISTORY_FACT_KEYS,
  HISTORY_FACT_LABEL,
  ORIGINS,
  ORIGIN_LABEL,
  TRANSMISSIONS,
  TRANSMISSION_LABEL,
  VAT_LABEL,
  VAT_REGIMES,
  VEHICLE_STATUS_LABEL,
  type FeatureGroup,
} from "@/lib/domain";

export interface VehicleFormValues {
  id?: string;
  version?: number;
  make?: string;
  model?: string;
  versionName?: string | null;
  status?: string;
  branchId?: string | null;
  priceEuros?: number | null;
  vatRegime?: string;
  firstRegistrationYear?: number | null;
  firstRegistrationMonth?: number | null;
  mileageKm?: number | null;
  fuel?: string | null;
  transmission?: string | null;
  bodyType?: string | null;
  powerHp?: number | null;
  engineCc?: number | null;
  doors?: number | null;
  seats?: number | null;
  drivetrain?: string | null;
  color?: string | null;
  origin?: string | null;
  evRangeKm?: number | null;
  evRangeStandard?: string | null;
  evBatteryKwh?: number | null;
  evCharging?: string | null;
  evBatterySohPercent?: number | null;
  evDataSource?: string | null;
  evDataDate?: string | null;
  historyFacts?: { key: string; value: string; source: string; verified_on: string }[];
  description?: string | null;
  warrantyText?: string | null;
  videoUrl?: string | null;
  isFeatured?: boolean;
  featureIds?: string[];
  vin?: string | null;
  plate?: string | null;
  purchaseCostEuros?: number | null;
  internalNotes?: string | null;
}

function F({ label, name, st, children, hint, className }: { label: string; name: string; st: ActionState; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={`v-${name}`} className="field-label">
        {label}
      </label>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
      {st.fields?.[name] && <p className="field-error">{st.fields[name]}</p>}
    </div>
  );
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function VehicleForm({
  action,
  values,
  branches,
  features,
  canSeePrivate,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  values: VehicleFormValues;
  branches: { id: string; name: string }[];
  features: { id: string; name: string; group: FeatureGroup }[];
  canSeePrivate: boolean;
}) {
  const [fuel, setFuel] = useState(values.fuel ?? "");
  const [facts, setFacts] = useState(values.historyFacts?.length ? values.historyFacts : []);
  const isEv = fuel === "electric" || fuel === "plugin_hybrid";
  const selected = new Set(values.featureIds ?? []);
  const year = new Date().getFullYear();

  return (
    <ActionForm action={action} submitLabel={values.id ? "Guardar alterações" : "Criar viatura"}>
      {(st) => (
        <>
          {values.id && <input type="hidden" name="id" value={values.id} />}
          {values.version !== undefined && <input type="hidden" name="expectedVersion" value={values.version} />}

          <fieldset className="panel grid gap-4 p-4 md:grid-cols-3">
            <legend className="heading px-1 text-base">Identificação</legend>
            <F label="Marca" name="make" st={st}>
              <input id="v-make" name="make" defaultValue={str(values.make)} required className="input" />
            </F>
            <F label="Modelo" name="model" st={st}>
              <input id="v-model" name="model" defaultValue={str(values.model)} required className="input" />
            </F>
            <F label="Versão" name="versionName" st={st}>
              <input id="v-versionName" name="versionName" defaultValue={str(values.versionName)} className="input" placeholder="ex.: 1.5 BlueHDi Allure EAT8" />
            </F>
            <F label="Estado" name="status" st={st} hint="Disponível e Reservado aparecem no site.">
              <select id="v-status" name="status" defaultValue={values.status ?? "draft"} className="input">
                {(["draft", "available", "sold", "archived"] as const).map((s) => (
                  <option key={s} value={s}>
                    {VEHICLE_STATUS_LABEL[s]}
                  </option>
                ))}
                {values.status === "reserved" && <option value="reserved">Reservado</option>}
              </select>
            </F>
            <F label="Instalação" name="branchId" st={st}>
              <select id="v-branchId" name="branchId" defaultValue={values.branchId ?? branches[0]?.id ?? ""} className="input">
                <option value="">—</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </F>
            <label className="flex items-center gap-2 self-end pb-3 text-sm font-semibold">
              <input type="checkbox" name="isFeatured" defaultChecked={values.isFeatured} className="check" /> Destacar na página inicial
            </label>
          </fieldset>

          <fieldset className="panel grid gap-4 p-4 md:grid-cols-3">
            <legend className="heading px-1 text-base">Preço</legend>
            <F label="Preço total de venda (€)" name="priceEuros" st={st} hint="Preço final ao consumidor, com IVA.">
              <input id="v-priceEuros" name="priceEuros" inputMode="decimal" defaultValue={str(values.priceEuros)} className="input num" />
            </F>
            <F label="Tratamento de IVA" name="vatRegime" st={st} className="md:col-span-2" hint="Obrigatório para publicar. Confirma com a contabilidade.">
              <select id="v-vatRegime" name="vatRegime" defaultValue={values.vatRegime ?? "unknown"} className="input">
                {VAT_REGIMES.map((v) => (
                  <option key={v} value={v}>
                    {VAT_LABEL[v]}
                  </option>
                ))}
              </select>
            </F>
          </fieldset>

          <fieldset className="panel grid gap-4 p-4 sm:grid-cols-2 md:grid-cols-4">
            <legend className="heading px-1 text-base">Características</legend>
            <F label="Ano 1.ª matrícula" name="firstRegistrationYear" st={st}>
              <select id="v-firstRegistrationYear" name="firstRegistrationYear" defaultValue={str(values.firstRegistrationYear)} className="input">
                <option value="">—</option>
                {Array.from({ length: 45 }, (_, i) => year + 1 - i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </F>
            <F label="Mês 1.ª matrícula" name="firstRegistrationMonth" st={st}>
              <select id="v-firstRegistrationMonth" name="firstRegistrationMonth" defaultValue={str(values.firstRegistrationMonth)} className="input">
                <option value="">Não indicado</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </F>
            <F label="Quilómetros" name="mileageKm" st={st}>
              <input id="v-mileageKm" name="mileageKm" inputMode="numeric" defaultValue={str(values.mileageKm)} className="input num" />
            </F>
            <F label="Combustível" name="fuel" st={st}>
              <select id="v-fuel" name="fuel" value={fuel} onChange={(e) => setFuel(e.target.value)} className="input">
                <option value="">—</option>
                {FUELS.map((f) => (
                  <option key={f} value={f}>
                    {FUEL_LABEL[f]}
                  </option>
                ))}
              </select>
            </F>
            <Sel label="Caixa" name="transmission" st={st} value={values.transmission} options={TRANSMISSIONS} labels={TRANSMISSION_LABEL} />
            <Sel label="Carroçaria" name="bodyType" st={st} value={values.bodyType} options={BODY_TYPES} labels={BODY_TYPE_LABEL} />
            <F label="Potência (cv)" name="powerHp" st={st}>
              <input id="v-powerHp" name="powerHp" inputMode="numeric" defaultValue={str(values.powerHp)} className="input num" />
            </F>
            <F label="Cilindrada (cm³)" name="engineCc" st={st}>
              <input id="v-engineCc" name="engineCc" inputMode="numeric" defaultValue={str(values.engineCc)} className="input num" />
            </F>
            <F label="Portas" name="doors" st={st}>
              <input id="v-doors" name="doors" inputMode="numeric" defaultValue={str(values.doors)} className="input num" />
            </F>
            <F label="Lugares" name="seats" st={st}>
              <input id="v-seats" name="seats" inputMode="numeric" defaultValue={str(values.seats)} className="input num" />
            </F>
            <Sel label="Tração" name="drivetrain" st={st} value={values.drivetrain} options={DRIVETRAINS} labels={DRIVETRAIN_LABEL} />
            <F label="Cor" name="color" st={st}>
              <input id="v-color" name="color" defaultValue={str(values.color)} className="input" />
            </F>
            <Sel label="Origem" name="origin" st={st} value={values.origin} options={ORIGINS} labels={ORIGIN_LABEL} />
          </fieldset>

          {isEv && (
            <fieldset className="panel grid gap-4 p-4 sm:grid-cols-2 md:grid-cols-4">
              <legend className="heading px-1 text-base">Bateria e autonomia</legend>
              <p className="text-sm text-muted sm:col-span-2 md:col-span-4">Só aparece no site com fonte e data. Usa apenas dados confirmados.</p>
              <F label="Autonomia declarada (km)" name="evRangeKm" st={st}>
                <input id="v-evRangeKm" name="evRangeKm" inputMode="numeric" defaultValue={str(values.evRangeKm)} className="input num" />
              </F>
              <F label="Norma" name="evRangeStandard" st={st}>
                <input id="v-evRangeStandard" name="evRangeStandard" defaultValue={str(values.evRangeStandard ?? (values.evRangeKm ? "" : "WLTP"))} className="input" />
              </F>
              <F label="Capacidade bateria (kWh)" name="evBatteryKwh" st={st}>
                <input id="v-evBatteryKwh" name="evBatteryKwh" inputMode="decimal" defaultValue={str(values.evBatteryKwh)} className="input num" />
              </F>
              <F label="Estado de saúde (%)" name="evBatterySohPercent" st={st}>
                <input id="v-evBatterySohPercent" name="evBatterySohPercent" inputMode="decimal" defaultValue={str(values.evBatterySohPercent)} className="input num" />
              </F>
              <F label="Carregamento" name="evCharging" st={st} className="sm:col-span-2">
                <input id="v-evCharging" name="evCharging" defaultValue={str(values.evCharging)} className="input" placeholder="ex.: AC 11 kW, DC até 85 kW" />
              </F>
              <F label="Fonte dos dados" name="evDataSource" st={st}>
                <input id="v-evDataSource" name="evDataSource" defaultValue={str(values.evDataSource)} className="input" placeholder="ex.: relatório de diagnóstico" />
              </F>
              <F label="Data da verificação" name="evDataDate" st={st}>
                <input id="v-evDataDate" name="evDataDate" type="date" defaultValue={str(values.evDataDate)} className="input" />
              </F>
            </fieldset>
          )}

          <fieldset className="panel space-y-4 p-4">
            <legend className="heading px-1 text-base">Texto</legend>
            <F label="Descrição" name="description" st={st}>
              <textarea id="v-description" name="description" defaultValue={str(values.description)} className="input min-h-40" maxLength={6000} />
            </F>
            <F label="Condições de garantia (aprovadas)" name="warrantyText" st={st} hint="Só texto aprovado pelo stand. Vazio = não aparece no site.">
              <textarea id="v-warrantyText" name="warrantyText" defaultValue={str(values.warrantyText)} className="input min-h-20" maxLength={2000} />
            </F>
            <F label="Vídeo (YouTube ou Vimeo, autorizado)" name="videoUrl" st={st}>
              <input id="v-videoUrl" name="videoUrl" type="url" defaultValue={str(values.videoUrl)} className="input" />
            </F>
          </fieldset>

          <fieldset className="panel p-4">
            <legend className="heading px-1 text-base">Histórico verificado</legend>
            <p className="text-sm text-muted">Proprietários, manutenção, inspeção ou ausência de acidentes só com fonte e data de verificação.</p>
            <div className="mt-3 space-y-3">
              {facts.map((f, i) => (
                <div key={i} className="grid gap-2 rounded-[var(--radius-sm)] border border-line p-3 md:grid-cols-[1fr_1fr_1.4fr_auto_auto]">
                  <select name={`fact_${i}_key`} defaultValue={f.key} className="input" aria-label="Facto">
                    {HISTORY_FACT_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {HISTORY_FACT_LABEL[k]}
                      </option>
                    ))}
                  </select>
                  <input name={`fact_${i}_value`} defaultValue={f.value} className="input" placeholder="Valor" aria-label="Valor" />
                  <input name={`fact_${i}_source`} defaultValue={f.source} className="input" placeholder="Fonte (ex.: DUA, livro de revisões)" aria-label="Fonte" />
                  <input name={`fact_${i}_date`} type="date" defaultValue={f.verified_on} className="input" aria-label="Data de verificação" />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFacts(facts.filter((_, j) => j !== i))}>
                    Remover
                  </button>
                </div>
              ))}
              {st.fields && Object.keys(st.fields).some((k) => k.startsWith("historyFacts")) && <p className="field-error">Cada facto precisa de valor, fonte e data.</p>}
              {facts.length < 10 && (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setFacts([...facts, { key: "owners", value: "", source: "", verified_on: "" }])}>
                  Adicionar facto
                </button>
              )}
            </div>
          </fieldset>

          <fieldset className="panel p-4">
            <legend className="heading px-1 text-base">Equipamento</legend>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURE_GROUPS.map((g) => {
                const items = features.filter((f) => f.group === g);
                if (!items.length) return null;
                return (
                  <div key={g}>
                    <p className="text-sm font-bold">{FEATURE_GROUP_LABEL[g]}</p>
                    <div className="mt-1 space-y-1">
                      {items.map((f) => (
                        <label key={f.id} className="flex items-start gap-2 text-sm">
                          <input type="checkbox" name="featureIds" value={f.id} defaultChecked={selected.has(f.id)} className="check" /> {f.name}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </fieldset>

          {canSeePrivate && (
            <fieldset className="panel grid gap-4 border-dashed p-4 md:grid-cols-2">
              <legend className="heading px-1 text-base">Dados internos (nunca aparecem no site)</legend>
              <F label="VIN" name="vin" st={st}>
                <input id="v-vin" name="vin" defaultValue={str(values.vin)} className="input font-mono uppercase" maxLength={17} />
              </F>
              <F label="Matrícula" name="plate" st={st}>
                <input id="v-plate" name="plate" defaultValue={str(values.plate)} className="input uppercase" maxLength={20} />
              </F>
              <F label="Custo de aquisição (€)" name="purchaseCostEuros" st={st}>
                <input id="v-purchaseCostEuros" name="purchaseCostEuros" inputMode="decimal" defaultValue={str(values.purchaseCostEuros)} className="input num" />
              </F>
              <F label="Notas internas" name="internalNotes" st={st}>
                <textarea id="v-internalNotes" name="internalNotes" defaultValue={str(values.internalNotes)} className="input min-h-20" />
              </F>
            </fieldset>
          )}
        </>
      )}
    </ActionForm>
  );
}

function Sel<T extends string>({ label, name, st, value, options, labels }: { label: string; name: string; st: ActionState; value?: string | null; options: readonly T[]; labels: Record<T, string> }) {
  return (
    <F label={label} name={name} st={st}>
      <select id={`v-${name}`} name={name} defaultValue={value ?? ""} className="input">
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {labels[o]}
          </option>
        ))}
      </select>
    </F>
  );
}

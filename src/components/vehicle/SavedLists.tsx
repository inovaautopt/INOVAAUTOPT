"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { clearList, removeFromList, useList } from "@/lib/local-lists";
import { BODY_TYPE_LABEL, DRIVETRAIN_LABEL, FUEL_LABEL, NOT_STATED, ORIGIN_LABEL, TRANSMISSION_LABEL, VEHICLE_STATUS_LABEL, type BodyType, type Drivetrain, type Fuel, type Origin, type Transmission, type VehicleStatus } from "@/lib/domain";
import { formatKm, formatPrice, formatRegistration } from "@/lib/format";
import { VehicleImage } from "./VehicleImage";

interface Item {
  id: string;
  reference: string;
  slug: string;
  status: VehicleStatus;
  isDemo: boolean;
  make: string;
  model: string;
  versionName: string | null;
  priceCents: number | null;
  firstRegistrationYear: number | null;
  firstRegistrationMonth: number | null;
  mileageKm: number | null;
  fuel: Fuel | null;
  transmission: Transmission | null;
  powerHp: number | null;
  engineCc: number | null;
  bodyType: BodyType | null;
  doors: number | null;
  seats: number | null;
  drivetrain: Drivetrain | null;
  color: string | null;
  origin: Origin | null;
  evRangeKm: number | null;
  evBatteryKwh: number | null;
  coverPath: string | null;
  coverAlt: string | null;
}

function useLookup(ids: string[]) {
  const key = ids.join(",");
  const [state, setState] = useState<{ key: string; items: Item[] | null; error: boolean }>({ key: "", items: null, error: false });
  useEffect(() => {
    if (!key) return;
    let alive = true;
    fetch(`/api/vehicles/lookup?ids=${encodeURIComponent(key)}`)
      .then((r) => r.json())
      .then((j) => alive && setState({ key, items: j.ok ? j.items : [], error: !j.ok }))
      .catch(() => alive && setState({ key, items: [], error: true }));
    return () => {
      alive = false;
    };
  }, [key]);
  if (!key) return { items: [] as Item[], loading: false, error: false };
  return { items: state.key === key ? state.items : null, loading: state.key !== key, error: state.error };
}

export function FavoritesList() {
  const ids = useList("favorites");
  const { items, loading, error } = useLookup(ids);
  if (ids.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-line bg-surface p-6">
        <p className="font-semibold">Ainda não guardaste viaturas.</p>
        <p className="mt-1 text-ink-soft">Usa o coração nas viaturas para as guardares aqui. Ficam guardadas só neste navegador, sem precisares de registo.</p>
        <Link href="/viaturas" className="btn btn-primary mt-4">
          Ver viaturas
        </Link>
      </div>
    );
  }
  if (loading || !items) return <ListSkeleton n={Math.min(ids.length, 3)} />;
  const missing = ids.filter((id) => !items.some((i) => i.id === id));
  return (
    <div className="space-y-4">
      {error && <p className="field-error">Não foi possível atualizar o estado das viaturas. Tenta recarregar a página.</p>}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((v) => (
          <li key={v.id} className="overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface">
            <Link href={`/viaturas/${v.slug}`} className="block">
              <VehicleImage path={v.coverPath} alt={v.coverAlt ?? `${v.make} ${v.model}`} sizes="(min-width: 1024px) 30vw, 100vw" className={v.status === "sold" ? "grayscale" : undefined} />
            </Link>
            <div className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/viaturas/${v.slug}`} className="heading text-lg hover:underline">
                  {v.make} {v.model}
                </Link>
                <button type="button" className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full hover:bg-chrome-hi" aria-label={`Remover ${v.make} ${v.model} dos favoritos`} onClick={() => removeFromList("favorites", v.id)}>
                  <X aria-hidden className="h-5 w-5" />
                </button>
              </div>
              <p className="flex flex-wrap items-center gap-2">
                <span className={`tag ${v.status === "available" ? "tag-ok" : v.status === "reserved" ? "tag-warn" : "tag-dark"}`}>{VEHICLE_STATUS_LABEL[v.status]}</span>
                {v.isDemo && <span className="tag tag-dark">Demonstração</span>}
              </p>
              <p className="heading text-xl num">{formatPrice(v.priceCents)}</p>
            </div>
          </li>
        ))}
      </ul>
      {missing.length > 0 && (
        <p className="text-sm text-muted">
          {missing.length === 1 ? "Uma viatura guardada já não está publicada" : `${missing.length} viaturas guardadas já não estão publicadas`}.{" "}
          <button type="button" className="font-semibold underline" onClick={() => missing.forEach((id) => removeFromList("favorites", id))}>
            Remover da lista
          </button>
        </p>
      )}
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => clearList("favorites")}>
        Limpar favoritos
      </button>
    </div>
  );
}

const ROWS: { label: string; get: (v: Item) => string }[] = [
  { label: "Preço", get: (v) => formatPrice(v.priceCents) },
  { label: "Estado", get: (v) => VEHICLE_STATUS_LABEL[v.status] },
  { label: "Primeira matrícula", get: (v) => formatRegistration(v.firstRegistrationYear, v.firstRegistrationMonth) },
  { label: "Quilómetros", get: (v) => formatKm(v.mileageKm) },
  { label: "Combustível", get: (v) => (v.fuel ? FUEL_LABEL[v.fuel] : NOT_STATED) },
  { label: "Caixa", get: (v) => (v.transmission ? TRANSMISSION_LABEL[v.transmission] : NOT_STATED) },
  { label: "Potência", get: (v) => (v.powerHp ? `${v.powerHp} cv` : NOT_STATED) },
  { label: "Cilindrada", get: (v) => (v.engineCc ? `${v.engineCc} cm³` : NOT_STATED) },
  { label: "Carroçaria", get: (v) => (v.bodyType ? BODY_TYPE_LABEL[v.bodyType] : NOT_STATED) },
  { label: "Portas", get: (v) => (v.doors ? String(v.doors) : NOT_STATED) },
  { label: "Lugares", get: (v) => (v.seats ? String(v.seats) : NOT_STATED) },
  { label: "Tração", get: (v) => (v.drivetrain ? DRIVETRAIN_LABEL[v.drivetrain] : NOT_STATED) },
  { label: "Cor", get: (v) => v.color ?? NOT_STATED },
  { label: "Origem", get: (v) => (v.origin ? ORIGIN_LABEL[v.origin] : NOT_STATED) },
  { label: "Autonomia", get: (v) => (v.evRangeKm ? `${v.evRangeKm} km` : NOT_STATED) },
];

export function CompareTable() {
  const ids = useList("compare");
  const { items, loading } = useLookup(ids);
  const [onlyDiff, setOnlyDiff] = useState(false);
  if (ids.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-line bg-surface p-6">
        <p className="font-semibold">O comparador está vazio.</p>
        <p className="mt-1 text-ink-soft">Escolhe até 4 viaturas com o botão «Comparar» para veres as diferenças lado a lado.</p>
        <Link href="/viaturas" className="btn btn-primary mt-4">
          Escolher viaturas
        </Link>
      </div>
    );
  }
  if (loading || !items) return <ListSkeleton n={Math.min(ids.length, 4)} />;
  const ordered = ids.map((id) => items.find((i) => i.id === id)).filter((x): x is Item => Boolean(x));
  const rows = ROWS.map((r) => {
    const values = ordered.map(r.get);
    return { ...r, values, differs: new Set(values).size > 1 };
  }).filter((r) => !r.values.every((x) => x === NOT_STATED));
  const visible = onlyDiff ? rows.filter((r) => r.differs) : rows;
  return (
    <div className="space-y-4">
      <label className="inline-flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" className="check" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} />
        Mostrar só as diferenças
      </label>
      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-line bg-surface">
        <table className="table min-w-[40rem]">
          <caption className="sr-only">Comparação de viaturas; linhas com valores diferentes estão destacadas.</caption>
          <thead>
            <tr>
              <th scope="col" className="w-40">
                <span className="sr-only">Característica</span>
              </th>
              {ordered.map((v) => (
                <th key={v.id} scope="col" className="min-w-44 align-top">
                  <div className="space-y-2">
                    <VehicleImage path={v.coverPath} alt="" sizes="200px" className="rounded-[var(--radius-sm)]" />
                    <Link href={`/viaturas/${v.slug}`} className="block text-base font-bold text-ink hover:underline">
                      {v.make} {v.model}
                    </Link>
                    <button type="button" className="block text-xs font-semibold text-danger underline" onClick={() => removeFromList("compare", v.id)}>
                      Remover
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.label} className={r.differs ? "bg-brand-soft/50" : undefined}>
                <th scope="row" className="text-ink">
                  {r.label}
                  {r.differs && <span className="sr-only"> (diferente)</span>}
                </th>
                {r.values.map((val, i) => (
                  <td key={i} className={`num ${val === NOT_STATED ? "text-muted" : "font-semibold"}`}>
                    {val}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ordered.length < ids.length && <p className="text-sm text-muted">Algumas viaturas escolhidas já não estão publicadas e foram omitidas.</p>}
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => clearList("compare")}>
        Limpar comparador
      </button>
    </div>
  );
}

function ListSkeleton({ n }: { n: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="A carregar">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="skeleton aspect-[4/3]" />
      ))}
    </div>
  );
}

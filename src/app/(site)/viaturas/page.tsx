import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { X } from "lucide-react";
import { vehicleFilters, filterRangeErrors, type VehicleFilters } from "@/lib/validation";
import { getFacets, searchVehicles } from "@/lib/vehicles";
import { BODY_TYPE_LABEL, DRIVETRAIN_LABEL, FUEL_LABEL, TRANSMISSION_LABEL } from "@/lib/domain";
import { VehicleCard } from "@/components/vehicle/VehicleCard";
import { FilterPanel, SortSelect } from "@/components/vehicle/FilterPanel";
import { SaveSearch } from "@/components/forms/SaveSearch";
import { formatNumber } from "@/lib/format";

type SP = Record<string, string | string[] | undefined>;

function flatten(sp: SP): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val !== undefined && val !== "") out[k] = val;
  }
  return out;
}

const KNOWN = new Set(["q", "marca", "modelo", "precoMin", "precoMax", "anoMin", "anoMax", "kmMin", "kmMax", "potenciaMin", "potenciaMax", "combustivel", "caixa", "carrocaria", "tracao", "lugares", "portas", "cor", "instalacao", "equipamento", "ordem", "pagina"]);

export async function generateMetadata(props: PageProps<"/viaturas">): Promise<Metadata> {
  const sp = flatten(await props.searchParams);
  const filterKeys = Object.keys(sp).filter((k) => k !== "pagina" && k !== "ordem");
  // Só a listagem sem filtros (e uma única marca) é indexável; combinações de filtros não.
  const indexable = filterKeys.length === 0 || (filterKeys.length === 1 && filterKeys[0] === "marca");
  const title = sp.marca ? `${sp.marca} usados` : "Viaturas disponíveis";
  return {
    title,
    description: sp.marca ? `Viaturas ${sp.marca} disponíveis no stand.` : "Todo o stock disponível: pesquisa por marca, modelo, preço, ano, quilómetros e combustível.",
    alternates: { canonical: sp.marca && indexable ? `/viaturas?marca=${encodeURIComponent(sp.marca)}` : "/viaturas" },
    robots: indexable && !sp.pagina ? undefined : { index: false, follow: true },
  };
}

function chipList(f: VehicleFilters, sp: Record<string, string>, featureNames: Map<string, string>) {
  const chips: { label: string; href: string }[] = [];
  const without = (key: string, value?: string) => {
    const next = new URLSearchParams(sp);
    next.delete("pagina");
    if (value === undefined) next.delete(key);
    else {
      const rest = (next.get(key) ?? "").split(",").filter((x) => x && x !== value);
      if (rest.length) next.set(key, rest.join(","));
      else next.delete(key);
    }
    if (key === "marca") next.delete("modelo");
    const qs = next.toString();
    return qs ? `/viaturas?${qs}` : "/viaturas";
  };
  if (f.q) chips.push({ label: `“${f.q}”`, href: without("q") });
  if (f.marca) chips.push({ label: f.marca, href: without("marca") });
  if (f.modelo) chips.push({ label: f.modelo, href: without("modelo") });
  if (f.precoMin !== undefined) chips.push({ label: `Desde ${formatNumber(f.precoMin)} €`, href: without("precoMin") });
  if (f.precoMax !== undefined) chips.push({ label: `Até ${formatNumber(f.precoMax)} €`, href: without("precoMax") });
  if (f.anoMin !== undefined) chips.push({ label: `Desde ${f.anoMin}`, href: without("anoMin") });
  if (f.anoMax !== undefined) chips.push({ label: `Até ${f.anoMax}`, href: without("anoMax") });
  if (f.kmMin !== undefined) chips.push({ label: `Desde ${formatNumber(f.kmMin)} km`, href: without("kmMin") });
  if (f.kmMax !== undefined) chips.push({ label: `Até ${formatNumber(f.kmMax)} km`, href: without("kmMax") });
  if (f.potenciaMin !== undefined) chips.push({ label: `Desde ${f.potenciaMin} cv`, href: without("potenciaMin") });
  if (f.potenciaMax !== undefined) chips.push({ label: `Até ${f.potenciaMax} cv`, href: without("potenciaMax") });
  f.combustivel.forEach((v) => chips.push({ label: FUEL_LABEL[v], href: without("combustivel", v) }));
  f.caixa.forEach((v) => chips.push({ label: `Caixa ${TRANSMISSION_LABEL[v].toLowerCase()}`, href: without("caixa", v) }));
  f.carrocaria.forEach((v) => chips.push({ label: BODY_TYPE_LABEL[v], href: without("carrocaria", v) }));
  f.tracao.forEach((v) => chips.push({ label: DRIVETRAIN_LABEL[v], href: without("tracao", v) }));
  if (f.lugares !== undefined) chips.push({ label: `${f.lugares} lugares`, href: without("lugares") });
  if (f.portas !== undefined) chips.push({ label: `${f.portas} portas`, href: without("portas") });
  if (f.cor) chips.push({ label: `Cor ${f.cor}`, href: without("cor") });
  if (f.instalacao) chips.push({ label: `Instalação ${f.instalacao}`, href: without("instalacao") });
  f.equipamento.forEach((id) => chips.push({ label: featureNames.get(id) ?? "Equipamento", href: without("equipamento", id) }));
  return chips;
}

export default async function CatalogPage(props: PageProps<"/viaturas">) {
  const raw = await props.searchParams;
  const sp = flatten(raw);

  // URL limpa: remove parâmetros vazios ou desconhecidos (partilhável e sem duplicados)
  const rawKeys = Object.keys(raw);
  if (rawKeys.some((k) => !KNOWN.has(k) || raw[k] === "" || Array.isArray(raw[k]))) {
    const clean = new URLSearchParams(Object.entries(sp).filter(([k]) => KNOWN.has(k)));
    const qs = clean.toString();
    redirect(qs ? `/viaturas?${qs}` : "/viaturas");
  }

  const filters = vehicleFilters.parse(sp);
  const errors = filterRangeErrors(filters);
  const [facets, result] = await Promise.all([getFacets(filters.marca), errors.length ? Promise.resolve(null) : searchVehicles(filters)]);
  const featureNames = new Map(facets.features.map((f) => [f.id, f.name]));
  const chips = chipList(filters, sp, featureNames);
  const total = result?.total ?? 0;

  const pageHref = (p: number) => {
    const next = new URLSearchParams(sp);
    if (p <= 1) next.delete("pagina");
    else next.set("pagina", String(p));
    const qs = next.toString();
    return qs ? `/viaturas?${qs}` : "/viaturas";
  };

  return (
    <div className="mx-auto max-w-[90rem] px-4 py-8 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[2rem] xs:text-4xl md:text-5xl">Viaturas</h1>
          <p className="mt-2 text-ink-soft" aria-live="polite">
            {errors.length ? "Corrige os filtros para ver resultados." : `${total} ${total === 1 ? "viatura encontrada" : "viaturas encontradas"}`}
          </p>
        </div>
        <form action="/viaturas" method="get" role="search" className="flex w-full gap-2 sm:w-auto">
          <label htmlFor="q" className="sr-only">
            Pesquisar por marca, modelo, versão ou referência
          </label>
          <input id="q" name="q" defaultValue={filters.q ?? ""} placeholder="Marca, modelo ou referência" className="input sm:w-72" />
          <button className="btn btn-dark" type="submit">
            Pesquisar
          </button>
        </form>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[18rem_1fr]">
        <FilterPanel facets={facets} total={total} activeCount={chips.length} />

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {chips.length > 0 ? (
              <ul className="flex flex-wrap items-center gap-2" aria-label="Filtros ativos">
                {chips.map((c) => (
                  <li key={c.href + c.label}>
                    <Link href={c.href} scroll={false} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-strong bg-surface pl-3 pr-2 text-sm font-medium hover:border-ink">
                      {c.label}
                      <X aria-hidden className="h-4 w-4" />
                      <span className="sr-only">(remover filtro)</span>
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/viaturas" className="px-2 text-sm font-semibold text-brand-ink underline-offset-2 hover:underline">
                    Limpar tudo
                  </Link>
                </li>
              </ul>
            ) : (
              <span />
            )}
            <SortSelect value={filters.ordem ?? "recent"} />
          </div>

          {errors.length > 0 && (
            <div role="alert" className="mt-6 rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
              <ul className="list-disc pl-5">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {result && result.items.length > 0 && (
            <ul className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {result.items.map((v, i) => (
                <li key={v.id}>
                  <VehicleCard v={v} priority={i < 2 && result.page === 1} />
                </li>
              ))}
            </ul>
          )}

          {result && result.items.length === 0 && (
            <div className="mt-6 rounded-[var(--radius-md)] border border-line bg-surface p-6">
              <h2 className="heading text-xl">Não há viaturas com estes critérios</h2>
              <p className="mt-2 text-ink-soft">
                {chips.length > 0 ? "Remove um dos filtros acima ou limpa a pesquisa para ver o restante stock." : "Neste momento não há viaturas publicadas."} Também podes pedir-nos um alerta e avisamos-te quando chegar uma viatura assim.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {chips.length > 0 && (
                  <Link href="/viaturas" className="btn btn-dark">
                    Limpar filtros
                  </Link>
                )}
                <Link href="/contactos" className="btn btn-outline">
                  Falar com o stand
                </Link>
              </div>
            </div>
          )}

          {result && result.pages > 1 && (
            <nav aria-label="Paginação" className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {result.page > 1 && (
                <Link className="btn btn-outline" href={pageHref(result.page - 1)} rel="prev">
                  Anterior
                </Link>
              )}
              {Array.from({ length: result.pages }, (_, i) => i + 1)
                .filter((p) => Math.abs(p - result.page) <= 2 || p === 1 || p === result.pages)
                .map((p) => (
                  <Link key={p} href={pageHref(p)} aria-current={p === result.page ? "page" : undefined} className={`btn ${p === result.page ? "btn-dark" : "btn-outline"} min-w-11 px-0 num`}>
                    {p}
                  </Link>
                ))}
              {result.page < result.pages && (
                <Link className="btn btn-outline" href={pageHref(result.page + 1)} rel="next">
                  Seguinte
                </Link>
              )}
            </nav>
          )}

          {!errors.length && <SaveSearch criteria={Object.fromEntries(Object.entries(sp).filter(([k]) => k !== "pagina" && k !== "ordem"))} />}
        </div>
      </div>
    </div>
  );
}

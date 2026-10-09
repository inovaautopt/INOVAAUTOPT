import "server-only";
import { cache } from "react";
import type { Fragment } from "postgres";
import { asPublic, type Tx } from "./db";
import type { BodyType, Drivetrain, FeatureGroup, Fuel, HistoryFact, Origin, Sort, Transmission, VatRegime, VehicleStatus } from "./domain";
import type { VehicleFilters } from "./validation";
import { isProduction } from "./env";

export const PAGE_SIZE = 12;

export interface VehicleCard {
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
  bodyType: BodyType | null;
  isFeatured: boolean;
  coverPath: string | null;
  coverAlt: string | null;
  coverWidth: number | null;
  coverHeight: number | null;
  previousPriceCents: number | null;
  branchName: string | null;
}

export interface VehicleDetail extends VehicleCard {
  vatRegime: VatRegime;
  engineCc: number | null;
  doors: number | null;
  seats: number | null;
  drivetrain: Drivetrain | null;
  color: string | null;
  origin: Origin | null;
  evRangeKm: number | null;
  evRangeStandard: string | null;
  evBatteryKwh: number | null;
  evCharging: string | null;
  evBatterySohPercent: number | null;
  evDataSource: string | null;
  evDataDate: string | null;
  historyFacts: HistoryFact[];
  description: string | null;
  warrantyText: string | null;
  videoUrl: string | null;
  publishedAt: Date | null;
  soldAt: Date | null;
  updatedAt: Date;
  branchId: string | null;
  media: { id: string; storagePath: string; altText: string | null; width: number | null; height: number | null; kind: "image" | "video" }[];
  features: { group: FeatureGroup; name: string }[];
}

/** Colunas de cartão. Em produção, dados de demonstração nunca aparecem (também imposto por RLS). */
function cardColumns(tx: Tx) {
  return tx`
    v.id, v.reference, v.slug, v.status, v.is_demo, v.make, v.model, v.version_name, v.price_cents,
    v.first_registration_year, v.first_registration_month, v.mileage_km, v.fuel, v.transmission,
    v.power_hp, v.body_type, v.is_featured,
    cover.storage_path as cover_path, cover.alt_text as cover_alt, cover.width as cover_width, cover.height as cover_height,
    (select h.old_price_cents from app.vehicle_price_history h
      where h.vehicle_id = v.id and h.new_price_cents = v.price_cents and h.old_price_cents > h.new_price_cents
        and h.changed_at > now() - interval '60 days'
      order by h.changed_at desc limit 1) as previous_price_cents,
    b.name as branch_name
  `;
}

function coverJoin(tx: Tx) {
  return tx`
    left join lateral (
      select m.storage_path, m.alt_text, m.width, m.height from app.vehicle_media m
       where m.vehicle_id = v.id and m.kind = 'image'
       order by m.is_cover desc, m.position asc, m.created_at asc limit 1
    ) cover on true
    left join app.branches b on b.id = v.branch_id
  `;
}

function demoFilter(tx: Tx) {
  return isProduction() ? tx`and not v.is_demo` : tx``;
}

function and(tx: Tx, parts: Fragment[]) {
  return parts.reduce((acc, p) => tx`${acc} and ${p}`, tx`true`);
}

export function buildWhere(tx: Tx, f: VehicleFilters): Fragment {
  const parts: Fragment[] = [tx`v.status in ('available', 'reserved')`];
  if (f.q) {
    const like = `%${f.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    parts.push(tx`(v.make ilike ${like} or v.model ilike ${like} or coalesce(v.version_name, '') ilike ${like}
      or v.reference ilike ${like} or (v.make || ' ' || v.model) ilike ${like})`);
  }
  if (f.marca) parts.push(tx`lower(v.make) = lower(${f.marca})`);
  if (f.modelo) parts.push(tx`lower(v.model) = lower(${f.modelo})`);
  if (f.precoMin !== undefined) parts.push(tx`v.price_cents >= ${f.precoMin * 100}`);
  if (f.precoMax !== undefined) parts.push(tx`v.price_cents <= ${f.precoMax * 100}`);
  if (f.anoMin !== undefined) parts.push(tx`v.first_registration_year >= ${f.anoMin}`);
  if (f.anoMax !== undefined) parts.push(tx`v.first_registration_year <= ${f.anoMax}`);
  if (f.kmMin !== undefined) parts.push(tx`v.mileage_km >= ${f.kmMin}`);
  if (f.kmMax !== undefined) parts.push(tx`v.mileage_km <= ${f.kmMax}`);
  if (f.potenciaMin !== undefined) parts.push(tx`v.power_hp >= ${f.potenciaMin}`);
  if (f.potenciaMax !== undefined) parts.push(tx`v.power_hp <= ${f.potenciaMax}`);
  if (f.combustivel.length) parts.push(tx`v.fuel in ${tx(f.combustivel)}`);
  if (f.caixa.length) parts.push(tx`v.transmission in ${tx(f.caixa)}`);
  if (f.carrocaria.length) parts.push(tx`v.body_type in ${tx(f.carrocaria)}`);
  if (f.tracao.length) parts.push(tx`v.drivetrain in ${tx(f.tracao)}`);
  if (f.lugares !== undefined) parts.push(tx`v.seats = ${f.lugares}`);
  if (f.portas !== undefined) parts.push(tx`v.doors = ${f.portas}`);
  if (f.cor) parts.push(tx`lower(v.color) = lower(${f.cor})`);
  if (f.instalacao) parts.push(tx`b.slug = ${f.instalacao}`);
  for (const featureId of f.equipamento) {
    parts.push(tx`exists (select 1 from app.vehicle_features vf where vf.vehicle_id = v.id and vf.feature_id = ${featureId})`);
  }
  return and(tx, parts);
}

function orderBy(tx: Tx, sort: Sort | undefined) {
  // Desempate estável por id para a paginação não repetir nem saltar viaturas
  switch (sort) {
    case "price_asc":
      return tx`order by v.price_cents asc nulls last, v.id`;
    case "price_desc":
      return tx`order by v.price_cents desc nulls last, v.id`;
    case "km_asc":
      return tx`order by v.mileage_km asc nulls last, v.id`;
    case "year_desc":
      return tx`order by v.first_registration_year desc nulls last, v.first_registration_month desc nulls last, v.id`;
    default:
      return tx`order by v.published_at desc nulls last, v.id`;
  }
}

export interface SearchResult {
  items: VehicleCard[];
  total: number;
  page: number;
  pages: number;
}

export async function searchVehicles(f: VehicleFilters): Promise<SearchResult> {
  const page = f.pagina ?? 1;
  return asPublic(async (tx) => {
    const where = buildWhere(tx, f);
    const [{ total }] = (await tx`
      select count(*)::int as total from app.vehicles v
      left join app.branches b on b.id = v.branch_id
      where ${where} ${demoFilter(tx)}
    `) as unknown as [{ total: number }];
    const items = (await tx`
      select ${cardColumns(tx)} from app.vehicles v ${coverJoin(tx)}
      where ${where} ${demoFilter(tx)}
      ${orderBy(tx, f.ordem)}
      limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}
    `) as unknown as VehicleCard[];
    return { items, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  });
}

export interface Facets {
  makes: { make: string; count: number }[];
  models: { model: string; count: number }[];
  colors: string[];
  branches: { slug: string; name: string }[];
  features: { id: string; name: string; group: FeatureGroup }[];
  priceRange: { min: number | null; max: number | null };
  hasElectric: boolean;
}

/** Opções dos filtros calculadas sobre o stock disponível (marca → modelos dependentes). */
export async function getFacets(selectedMake?: string): Promise<Facets> {
  return asPublic(async (tx) => {
    const base = tx`from app.vehicles v where v.status in ('available', 'reserved') ${demoFilter(tx)}`;
    const makes = (await tx`select v.make, count(*)::int as count ${base} group by v.make order by v.make`) as unknown as Facets["makes"];
    const models = selectedMake
      ? ((await tx`select v.model, count(*)::int as count ${base} and lower(v.make) = lower(${selectedMake}) group by v.model order by v.model`) as unknown as Facets["models"])
      : [];
    const colors = ((await tx`select distinct v.color ${base} and v.color is not null order by v.color`) as unknown as { color: string }[]).map((r) => r.color);
    const branches = (await tx`
      select distinct b.slug, b.name from app.branches b join app.vehicles v on v.branch_id = b.id
      where v.status in ('available', 'reserved') ${demoFilter(tx)} order by b.name`) as unknown as Facets["branches"];
    const features = (await tx`
      select distinct f.id, f.name, f.feature_group as "group" from app.features f
      join app.vehicle_features vf on vf.feature_id = f.id
      join app.vehicles v on v.id = vf.vehicle_id
      where v.status in ('available', 'reserved') ${demoFilter(tx)}
      order by f.name`) as unknown as Facets["features"];
    const [range] = (await tx`select min(v.price_cents) as min, max(v.price_cents) as max, bool_or(v.fuel = 'electric') as has_electric ${base}`) as unknown as [
      { min: number | null; max: number | null; hasElectric: boolean | null },
    ];
    return {
      makes,
      models,
      colors,
      branches,
      features,
      priceRange: { min: range?.min ?? null, max: range?.max ?? null },
      hasElectric: Boolean(range?.hasElectric),
    };
  });
}

export const getVehicleBySlug = cache(async (slug: string): Promise<{ vehicle: VehicleDetail | null; redirectTo: string | null }> => {
  return asPublic(async (tx) => {
    const rows = (await tx`
      select ${cardColumns(tx)}, v.vat_regime, v.engine_cc, v.doors, v.seats, v.drivetrain, v.color, v.origin,
        v.ev_range_km, v.ev_range_standard, v.ev_battery_kwh::float8 as ev_battery_kwh, v.ev_charging,
        v.ev_battery_soh_percent::float8 as ev_battery_soh_percent, v.ev_data_source, v.ev_data_date::text as ev_data_date,
        v.history_facts, v.description, v.warranty_text, v.video_url, v.published_at, v.sold_at, v.updated_at, v.branch_id
      from app.vehicles v ${coverJoin(tx)}
      where v.slug = ${slug} ${demoFilter(tx)}
    `) as unknown as VehicleDetail[];
    const vehicle = rows[0];
    if (!vehicle) {
      const [redir] = (await tx`
        select v.slug from app.vehicle_slug_redirects r join app.vehicles v on v.id = r.vehicle_id
        where r.old_slug = ${slug} ${demoFilter(tx)}`) as unknown as { slug: string }[];
      return { vehicle: null, redirectTo: redir?.slug ?? null };
    }
    vehicle.media = (await tx`
      select id, storage_path, alt_text, width, height, kind from app.vehicle_media
      where vehicle_id = ${vehicle.id} order by is_cover desc, position asc, created_at asc`) as unknown as VehicleDetail["media"];
    vehicle.features = (await tx`
      select f.feature_group as "group", f.name from app.vehicle_features vf join app.features f on f.id = vf.feature_id
      where vf.vehicle_id = ${vehicle.id} order by f.feature_group, f.name`) as unknown as VehicleDetail["features"];
    return { vehicle, redirectTo: null };
  });
});

/** Viaturas semelhantes disponíveis (mesma carroçaria ou marca, preço próximo). */
export async function getSimilarVehicles(v: VehicleDetail, limit = 3): Promise<VehicleCard[]> {
  return asPublic(async (tx) => {
    const price = v.priceCents ?? 0;
    return (await tx`
      select ${cardColumns(tx)} from app.vehicles v ${coverJoin(tx)}
      where v.status = 'available' and v.id <> ${v.id} ${demoFilter(tx)}
      order by (case when v.body_type = ${v.bodyType} then 0 else 1 end)
             + (case when v.make = ${v.make} then 0 else 1 end),
             abs(coalesce(v.price_cents, 0) - ${price}), v.id
      limit ${limit}`) as unknown as VehicleCard[];
  });
}

export async function getFeaturedVehicles(limit = 6): Promise<VehicleCard[]> {
  return asPublic(async (tx) => {
    return (await tx`
      select ${cardColumns(tx)} from app.vehicles v ${coverJoin(tx)}
      where v.status in ('available', 'reserved') ${demoFilter(tx)}
      order by v.is_featured desc, v.published_at desc nulls last, v.id
      limit ${limit}`) as unknown as VehicleCard[];
  });
}

export async function getStockCounts(): Promise<{ available: number; bodyTypes: { bodyType: BodyType; count: number }[]; fuels: { fuel: Fuel; count: number }[] }> {
  return asPublic(async (tx) => {
    const [{ available }] = (await tx`select count(*)::int as available from app.vehicles v where v.status in ('available', 'reserved') ${demoFilter(tx)}`) as unknown as [{ available: number }];
    const bodyTypes = (await tx`select v.body_type, count(*)::int as count from app.vehicles v
      where v.status in ('available', 'reserved') and v.body_type is not null ${demoFilter(tx)} group by v.body_type order by count desc`) as unknown as { bodyType: BodyType; count: number }[];
    const fuels = (await tx`select v.fuel, count(*)::int as count from app.vehicles v
      where v.status in ('available', 'reserved') and v.fuel is not null ${demoFilter(tx)} group by v.fuel order by count desc`) as unknown as { fuel: Fuel; count: number }[];
    return { available, bodyTypes, fuels };
  });
}

/** Estado atual de várias viaturas (favoritos / comparador guardados no navegador). */
export async function getVehiclesByIds(ids: string[]): Promise<VehicleDetail[]> {
  const clean = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 24);
  if (clean.length === 0) return [];
  return asPublic(async (tx) => {
    const rows = (await tx`
      select ${cardColumns(tx)}, v.vat_regime, v.engine_cc, v.doors, v.seats, v.drivetrain, v.color, v.origin,
        v.ev_range_km, v.ev_range_standard, v.ev_battery_kwh::float8 as ev_battery_kwh, v.ev_charging,
        v.ev_battery_soh_percent::float8 as ev_battery_soh_percent, v.ev_data_source, v.ev_data_date::text as ev_data_date,
        v.history_facts, v.description, v.warranty_text, v.video_url, v.published_at, v.sold_at, v.updated_at, v.branch_id
      from app.vehicles v ${coverJoin(tx)}
      where v.id in ${tx(clean)} ${demoFilter(tx)}`) as unknown as VehicleDetail[];
    for (const r of rows) {
      r.media = [];
      r.features = [];
    }
    return rows;
  });
}

export async function getPublicSlugs(): Promise<{ slug: string; updatedAt: Date; status: VehicleStatus }[]> {
  return asPublic(async (tx) => {
    return (await tx`select v.slug, v.updated_at, v.status from app.vehicles v
      where v.status in ('available', 'reserved') ${demoFilter(tx)} order by v.updated_at desc limit 5000`) as unknown as {
      slug: string;
      updatedAt: Date;
      status: VehicleStatus;
    }[];
  });
}

/** Marcas e modelos disponíveis para a pesquisa rápida (marca → modelos). */
export async function getMakeModelMap(): Promise<{ make: string; models: string[]; count: number }[]> {
  return asPublic(async (tx) => {
    const rows = (await tx`
      select v.make, array_agg(distinct v.model order by v.model) as models, count(*)::int as count
      from app.vehicles v where v.status in ('available', 'reserved') ${demoFilter(tx)}
      group by v.make order by v.make`) as unknown as { make: string; models: string[]; count: number }[];
    return rows;
  });
}

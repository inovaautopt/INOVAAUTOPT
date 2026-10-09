import "server-only";
import type { Tx } from "@/lib/db";
import { ConflictError } from "@/lib/db";
import { slugify } from "@/lib/format";
import type { VehicleEditorInput } from "@/lib/validation";
import type { VehicleStatus } from "@/lib/domain";

export interface AdminVehicle {
  id: string;
  reference: string;
  slug: string;
  status: VehicleStatus;
  isDemo: boolean;
  branchId: string | null;
  make: string;
  model: string;
  versionName: string | null;
  priceCents: number | null;
  vatRegime: string;
  firstRegistrationYear: number | null;
  firstRegistrationMonth: number | null;
  mileageKm: number | null;
  fuel: string | null;
  transmission: string | null;
  bodyType: string | null;
  powerHp: number | null;
  engineCc: number | null;
  doors: number | null;
  seats: number | null;
  drivetrain: string | null;
  color: string | null;
  origin: string | null;
  evRangeKm: number | null;
  evRangeStandard: string | null;
  evBatteryKwh: number | null;
  evCharging: string | null;
  evBatterySohPercent: number | null;
  evDataSource: string | null;
  evDataDate: string | null;
  historyFacts: unknown[];
  description: string | null;
  warrantyText: string | null;
  videoUrl: string | null;
  isFeatured: boolean;
  publishedAt: Date | null;
  soldAt: Date | null;
  updatedAt: Date;
  version: number;
}

export async function loadVehicle(tx: Tx, id: string): Promise<AdminVehicle | null> {
  const [v] = (await tx`select id, reference, slug, status, is_demo, branch_id, make, model, version_name, price_cents, vat_regime,
      first_registration_year, first_registration_month, mileage_km, fuel, transmission, body_type, power_hp, engine_cc, doors, seats,
      drivetrain, color, origin, ev_range_km, ev_range_standard, ev_battery_kwh::float8 as ev_battery_kwh, ev_charging, ev_battery_soh_percent::float8 as ev_battery_soh_percent,
      ev_data_source, ev_data_date::text as ev_data_date, history_facts, description, warranty_text, video_url, is_featured,
      published_at, sold_at, updated_at, version
    from app.vehicles where id = ${id}`) as unknown as AdminVehicle[];
  return v ?? null;
}

function vehicleColumns(input: VehicleEditorInput, staffId: string) {
  return {
    make: input.make,
    model: input.model,
    versionName: input.versionName,
    status: input.status,
    branchId: input.branchId,
    priceCents: input.priceEuros === null ? null : Math.round(input.priceEuros * 100),
    vatRegime: input.vatRegime,
    firstRegistrationYear: input.firstRegistrationYear,
    firstRegistrationMonth: input.firstRegistrationMonth,
    mileageKm: input.mileageKm,
    fuel: input.fuel,
    transmission: input.transmission,
    bodyType: input.bodyType,
    powerHp: input.powerHp,
    engineCc: input.engineCc,
    doors: input.doors,
    seats: input.seats,
    drivetrain: input.drivetrain,
    color: input.color,
    origin: input.origin,
    evRangeKm: input.evRangeKm,
    evRangeStandard: input.evRangeStandard,
    evBatteryKwh: input.evBatteryKwh,
    evCharging: input.evCharging,
    evBatterySohPercent: input.evBatterySohPercent,
    evDataSource: input.evDataSource,
    evDataDate: input.evDataDate,
    description: input.description,
    warrantyText: input.warrantyText,
    videoUrl: input.videoUrl,
    isFeatured: input.isFeatured,
    updatedBy: staffId,
  };
}

export function buildSlug(make: string, model: string, version: string | null, reference: string) {
  return slugify([make, model, version, reference].filter(Boolean).join(" ")).replace(/-+/g, "-");
}

/**
 * Cria ou atualiza uma viatura com controlo de concorrência otimista (version).
 * Os dados privados (VIN, matrícula, custo) vão para vehicle_private_details.
 */
export async function saveVehicle(tx: Tx, staffId: string, input: VehicleEditorInput, id?: string): Promise<{ id: string; slug: string }> {
  const cols = vehicleColumns(input, staffId);
  let vehicleId: string;
  let slug: string;
  if (!id) {
    const [{ reference }] = (await tx`select app.next_vehicle_reference() as reference`) as unknown as [{ reference: string }];
    slug = buildSlug(input.make, input.model, input.versionName, reference);
    const [row] = (await tx`insert into app.vehicles ${tx({ ...cols, reference, slug, createdBy: staffId, historyFacts: tx.json(input.historyFacts as never) } as never)}
      returning id, slug`) as unknown as { id: string; slug: string }[];
    vehicleId = row!.id;
    slug = row!.slug;
  } else {
    const current = await loadVehicle(tx, id);
    if (!current) throw new Error("Viatura não encontrada.");
    // O slug acompanha marca/modelo/versão; o antigo fica como redirecionamento (trigger)
    slug = buildSlug(input.make, input.model, input.versionName, current.reference);
    const rows = await tx`update app.vehicles set ${tx({ ...cols, slug, historyFacts: tx.json(input.historyFacts as never) } as never)}
      where id = ${id} and version = ${input.expectedVersion ?? current.version} returning id`;
    if (rows.length === 0) throw new ConflictError();
    vehicleId = id;
  }

  await tx`delete from app.vehicle_features where vehicle_id = ${vehicleId}`;
  if (input.featureIds.length) {
    await tx`insert into app.vehicle_features ${tx(input.featureIds.map((f) => ({ vehicleId, featureId: f })))} on conflict do nothing`;
  }
  return { id: vehicleId, slug };
}

export async function savePrivateDetails(tx: Tx, vehicleId: string, input: Pick<VehicleEditorInput, "vin" | "plate" | "purchaseCostEuros" | "internalNotes">) {
  await tx`insert into app.vehicle_private_details (vehicle_id, vin, plate, purchase_cost_cents, internal_notes)
    values (${vehicleId}, ${input.vin}, ${input.plate}, ${input.purchaseCostEuros === null ? null : Math.round(input.purchaseCostEuros * 100)}, ${input.internalNotes})
    on conflict (vehicle_id) do update set vin = excluded.vin, plate = excluded.plate,
      purchase_cost_cents = excluded.purchase_cost_cents, internal_notes = excluded.internal_notes`;
}

/** Duplica uma viatura: nova referência, estado Rascunho, sem fotografias nem dados privados. */
export async function duplicateVehicle(tx: Tx, staffId: string, id: string): Promise<string> {
  const v = await loadVehicle(tx, id);
  if (!v) throw new Error("Viatura não encontrada.");
  const [{ reference }] = (await tx`select app.next_vehicle_reference() as reference`) as unknown as [{ reference: string }];
  const slug = buildSlug(v.make, v.model, v.versionName, reference);
  const [row] = (await tx`insert into app.vehicles (reference, slug, status, branch_id, make, model, version_name, price_cents, vat_regime,
      first_registration_year, first_registration_month, mileage_km, fuel, transmission, body_type, power_hp, engine_cc, doors, seats,
      drivetrain, color, origin, description, warranty_text, created_by, updated_by, is_demo)
    select ${reference}, ${slug}, 'draft', branch_id, make, model, version_name, price_cents, vat_regime,
      first_registration_year, first_registration_month, mileage_km, fuel, transmission, body_type, power_hp, engine_cc, doors, seats,
      drivetrain, color, origin, description, warranty_text, ${staffId}, ${staffId}, is_demo
    from app.vehicles where id = ${id} returning id`) as unknown as { id: string }[];
  await tx`insert into app.vehicle_features (vehicle_id, feature_id) select ${row!.id}, feature_id from app.vehicle_features where vehicle_id = ${id}`;
  return row!.id;
}

export async function setVehicleStatus(tx: Tx, staffId: string, id: string, status: VehicleStatus, expectedVersion: number) {
  const rows = await tx`update app.vehicles set status = ${status}, updated_by = ${staffId} where id = ${id} and version = ${expectedVersion} returning id`;
  if (rows.length === 0) throw new ConflictError();
}

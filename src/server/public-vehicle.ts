import "server-only";
import type { VehicleCard } from "@/lib/vehicles";
import { mediaUrl } from "@/lib/storage-url";
import { siteUrl } from "@/lib/env";

/** Projeção pública estável para a API (sem campos internos). */
export function publicVehicleJson(v: VehicleCard) {
  return {
    id: v.id,
    reference: v.reference,
    url: siteUrl(`/viaturas/${v.slug}`),
    status: v.status,
    make: v.make,
    model: v.model,
    version: v.versionName,
    priceEur: v.priceCents !== null ? v.priceCents / 100 : null,
    firstRegistration: v.firstRegistrationYear ? { year: v.firstRegistrationYear, month: v.firstRegistrationMonth } : null,
    mileageKm: v.mileageKm,
    fuel: v.fuel,
    transmission: v.transmission,
    powerHp: v.powerHp,
    bodyType: v.bodyType,
    image: v.coverPath ? mediaUrl(v.coverPath, 960) : null,
    demo: v.isDemo || undefined,
  };
}

import { NextResponse } from "next/server";
import { getVehiclesByIds } from "@/lib/vehicles";
import { apiError } from "@/server/http";

/**
 * GET /api/vehicles/lookup?ids=a,b,c — estado ATUAL das viaturas guardadas no navegador
 * (favoritos/comparador). Só devolve viaturas publicadas; as restantes são omitidas.
 */
export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 50);
  try {
    const items = await getVehiclesByIds(ids);
    return NextResponse.json(
      {
        ok: true,
        items: items.map((v) => ({
          id: v.id,
          reference: v.reference,
          slug: v.slug,
          status: v.status,
          isDemo: v.isDemo,
          make: v.make,
          model: v.model,
          versionName: v.versionName,
          priceCents: v.priceCents,
          vatRegime: v.vatRegime,
          firstRegistrationYear: v.firstRegistrationYear,
          firstRegistrationMonth: v.firstRegistrationMonth,
          mileageKm: v.mileageKm,
          fuel: v.fuel,
          transmission: v.transmission,
          powerHp: v.powerHp,
          engineCc: v.engineCc,
          bodyType: v.bodyType,
          doors: v.doors,
          seats: v.seats,
          drivetrain: v.drivetrain,
          color: v.color,
          origin: v.origin,
          evRangeKm: v.evRangeKm,
          evBatteryKwh: v.evBatteryKwh,
          coverPath: v.coverPath,
          coverAlt: v.coverAlt,
          previousPriceCents: v.previousPriceCents,
          branchName: v.branchName,
          isFeatured: v.isFeatured,
          coverWidth: v.coverWidth,
          coverHeight: v.coverHeight,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("lookup", (err as Error).message);
    return apiError("unavailable", "Não foi possível carregar as viaturas.");
  }
}

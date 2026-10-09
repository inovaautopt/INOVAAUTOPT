import { vehicleFilters, filterRangeErrors } from "@/lib/validation";
import { searchVehicles } from "@/lib/vehicles";
import { apiError } from "@/server/http";
import { NextResponse } from "next/server";
import { publicVehicleJson } from "@/server/public-vehicle";

/** GET /api/vehicles — stock publicado, paginado. Mesmos parâmetros que a página /viaturas. */
export async function GET(req: Request) {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const filters = vehicleFilters.parse(params);
  const errors = filterRangeErrors(filters);
  if (errors.length) return apiError("validation_error", errors.join(" "));
  try {
    const res = await searchVehicles(filters);
    return NextResponse.json(
      { ok: true, page: res.page, pages: res.pages, total: res.total, items: res.items.map(publicVehicleJson) },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch (err) {
    console.error("GET /api/vehicles", (err as Error).message);
    return apiError("unavailable", "Stock temporariamente indisponível.");
  }
}

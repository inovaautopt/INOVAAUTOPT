import { NextResponse } from "next/server";
import { getVehiclesByIds } from "@/lib/vehicles";
import { apiError } from "@/server/http";
import { publicVehicleJson } from "@/server/public-vehicle";

/** GET /api/vehicles/[id] — dados públicos de uma viatura publicada (inclui vendidas, com estado). */
export async function GET(_req: Request, ctx: RouteContext<"/api/vehicles/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return apiError("not_found", "Viatura não encontrada.");
  try {
    const [v] = await getVehiclesByIds([id]);
    if (!v) return apiError("not_found", "Viatura não encontrada.");
    return NextResponse.json({ ok: true, item: publicVehicleJson(v) }, { headers: { "Cache-Control": "public, s-maxage=60" } });
  } catch (err) {
    console.error("GET /api/vehicles/[id]", (err as Error).message);
    return apiError("unavailable", "Stock temporariamente indisponível.");
  }
}

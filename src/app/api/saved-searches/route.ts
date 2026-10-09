import { after } from "next/server";
import { processOutbox } from "@/server/outbox-worker";
import { savedSearchInput, fieldErrors } from "@/lib/validation";
import { apiError, apiOk, readJson } from "@/server/http";
import { clientIp, rateLimit, sameOrigin } from "@/server/abuse";
import { createSavedSearch } from "@/server/saved-searches";

/** POST /api/saved-searches — cria alerta por email (exige confirmação). */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return apiError("forbidden", "Pedido de origem não autorizada.");
  let body: unknown;
  try {
    body = await readJson(req, 8000);
  } catch {
    return apiError("rejected", "Pedido inválido.");
  }
  const parsed = savedSearchInput.safeParse(body);
  if (!parsed.success) return apiError("validation_error", "Indica um email válido.", fieldErrors(parsed.error));
  if (parsed.data.website) return apiError("rejected", "Pedido inválido.");
  if (!(await rateLimit("saved_search", clientIp(req.headers), 5, 3600)) || !(await rateLimit("saved_search_email", parsed.data.email, 5, 86400))) {
    return apiError("rate_limited", "Demasiados pedidos. Tenta mais tarde.");
  }
  try {
    await createSavedSearch(parsed.data.email, parsed.data.criteria);
    after(() => processOutbox(10).catch((e) => console.error("outbox", e)));
    return apiOk({ message: "Enviámos um email para confirmares o alerta. Se não o vires, verifica a pasta de spam." }, 202);
  } catch (err) {
    console.error("saved-search", (err as Error).message);
    return apiError("internal_error", "Não foi possível criar o alerta.");
  }
}

import { after } from "next/server";
import { processOutbox } from "@/server/outbox-worker";
import { tradeInInput, fieldErrors } from "@/lib/validation";
import { apiError, apiOk } from "@/server/http";
import { clientIp, looksAutomated, rateLimit, sameOrigin } from "@/server/abuse";
import { createTradeInRequest, PublicRequestError } from "@/server/leads";
import { storePrivateImage, removeObjects, UploadError } from "@/server/storage";
import { getPublicSettings } from "@/lib/settings";

const MAX_PHOTOS = 6;

/**
 * POST /api/trade-ins — pedido de avaliação de retoma (multipart/form-data).
 * Campo "data" com JSON dos campos e até 6 ficheiros "photos". O resultado é um pedido
 * de avaliação: não há preço automático nem garantia de compra.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return apiError("forbidden", "Pedido de origem não autorizada.");
  const settings = await getPublicSettings();
  if (!settings.services.trade_in) return apiError("not_found", "O serviço de retomas não está disponível.");
  const length = Number(req.headers.get("content-length") ?? "0");
  if (length > 45 * 1024 * 1024) return apiError("rejected", "Os ficheiros são demasiado grandes (máximo 6 fotografias de 10 MB).");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError("rejected", "Pedido inválido.");
  }
  let json: unknown;
  try {
    json = JSON.parse(String(form.get("data") ?? "{}"));
  } catch {
    return apiError("rejected", "Pedido inválido.");
  }
  const parsed = tradeInInput.safeParse(json);
  if (!parsed.success) return apiError("validation_error", "Revê os campos assinalados.", fieldErrors(parsed.error));
  if (looksAutomated(parsed.data)) return apiError("rejected", "Não foi possível enviar o pedido. Tenta novamente.");
  if (!(await rateLimit("trade_in", clientIp(req.headers), 4, 3600))) {
    return apiError("rate_limited", "Recebemos vários pedidos seguidos. Tenta novamente mais tarde ou liga-nos.");
  }

  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_PHOTOS) return apiError("validation_error", `Podes enviar até ${MAX_PHOTOS} fotografias.`, { photos: `Máximo ${MAX_PHOTOS} fotografias.` });

  const stored: { path: string; mime: string; size: number }[] = [];
  try {
    for (const f of files) {
      stored.push(await storePrivateImage(`trade-ins/${parsed.data.idempotencyKey}`, Buffer.from(await f.arrayBuffer())));
    }
  } catch (err) {
    await removeObjects("private-media", stored.map((s) => s.path)).catch(() => {});
    if (err instanceof UploadError) return apiError("validation_error", err.message, { photos: err.message });
    console.error("Falha no upload de retoma", (err as Error).message);
    return apiError("internal_error", "Não foi possível guardar as fotografias. Tenta sem fotografias ou contacta-nos.");
  }

  try {
    const res = await createTradeInRequest(parsed.data, stored);
    if (!res.created) await removeObjects("private-media", stored.map((s) => s.path)).catch(() => {});
    after(() => processOutbox(10).catch((e) => console.error("outbox", e)));
    return apiOk({ reference: res.reference, duplicate: !res.created }, res.created ? 201 : 200);
  } catch (err) {
    await removeObjects("private-media", stored.map((s) => s.path)).catch(() => {});
    if (err instanceof PublicRequestError) return apiError("validation_error", err.message, err.field ? { [err.field]: err.message } : undefined);
    console.error("Falha ao gravar retoma", (err as Error).message);
    return apiError("internal_error", "Não foi possível guardar o pedido. Tenta novamente ou contacta-nos por telefone.");
  }
}

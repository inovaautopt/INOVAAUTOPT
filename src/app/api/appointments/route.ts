import { after } from "next/server";
import { processOutbox } from "@/server/outbox-worker";
import { appointmentInput, fieldErrors } from "@/lib/validation";
import { apiError, apiOk, readJson } from "@/server/http";
import { clientIp, looksAutomated, rateLimit, sameOrigin } from "@/server/abuse";
import { createAppointmentRequest, PublicRequestError } from "@/server/leads";

/** POST /api/appointments — pedido de visita ou test drive (sujeito a confirmação do stand). */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return apiError("forbidden", "Pedido de origem não autorizada.");
  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    return apiError("rejected", "Pedido inválido.");
  }
  const parsed = appointmentInput.safeParse(body);
  if (!parsed.success) return apiError("validation_error", "Revê os campos assinalados.", fieldErrors(parsed.error));
  if (looksAutomated(parsed.data)) return apiError("rejected", "Não foi possível enviar o pedido. Tenta novamente.");
  if (!(await rateLimit("appointment", clientIp(req.headers), 6, 3600))) {
    return apiError("rate_limited", "Recebemos vários pedidos seguidos. Tenta novamente mais tarde ou liga-nos.");
  }
  try {
    const res = await createAppointmentRequest(parsed.data);
    after(() => processOutbox(10).catch((e) => console.error("outbox", e)));
    return apiOk({ reference: res.reference, duplicate: !res.created, status: "requested" }, res.created ? 201 : 200);
  } catch (err) {
    if (err instanceof PublicRequestError) return apiError("validation_error", err.message, err.field ? { [err.field]: err.message } : undefined);
    console.error("Falha ao gravar marcação", (err as Error).message);
    return apiError("internal_error", "Não foi possível guardar o pedido. Tenta novamente ou contacta-nos por telefone.");
  }
}

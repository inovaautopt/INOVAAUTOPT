import { NextResponse, after } from "next/server";
import { asSystem } from "@/lib/db";
import { hashBody, splitEvents, verifySignature, verifySubscription } from "@/server/whatsapp";
import { processIntegrationEvents } from "@/server/outbox-worker";

/** GET: verificação da subscrição (hub.mode / hub.verify_token → hub.challenge). */
export async function GET(req: Request) {
  const challenge = verifySubscription(new URL(req.url).searchParams);
  if (!challenge) return new NextResponse("Forbidden", { status: 403 });
  return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

/**
 * POST: valida a assinatura sobre o corpo BRUTO, persiste e deduplica cada evento ANTES de
 * responder 200, e processa depois (after + processamento agendado). Um 200 aqui significa só
 * "recebido", nunca "mensagem entregue".
 */
export async function POST(req: Request) {
  const raw = Buffer.from(await req.arrayBuffer());
  if (raw.byteLength > 3 * 1024 * 1024) return new NextResponse("Payload Too Large", { status: 413 });
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) return new NextResponse("Invalid signature", { status: 401 });
  let body: unknown;
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }
  const events = splitEvents(body as Parameters<typeof splitEvents>[0], hashBody(raw));
  try {
    await asSystem(async (tx) => {
      for (const e of events) {
        await tx`insert into app.integration_events (provider, event_key, payload) values ('whatsapp', ${e.key}, ${tx.json(e.payload as never)})
                 on conflict (provider, event_key) do nothing`;
      }
    });
  } catch (err) {
    console.error("webhook whatsapp: falha a persistir", (err as Error).message);
    return new NextResponse("Retry", { status: 500 }); // a Meta volta a tentar
  }
  after(() => processIntegrationEvents(50).catch((e) => console.error("processamento webhook", e)));
  return NextResponse.json({ ok: true });
}

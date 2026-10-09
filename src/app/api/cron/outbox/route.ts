import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { expireReservations, generateSearchAlerts, processIntegrationEvents, processOutbox } from "@/server/outbox-worker";

export const maxDuration = 60;

function authorized(req: Request) {
  const secret = env().CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Processamento agendado autenticado (Vercel Cron envia GET com "Authorization: Bearer CRON_SECRET";
 * pg_cron/pg_net pode chamar com POST e o mesmo cabeçalho). Idempotente: pode correr em paralelo.
 */
async function run(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Não autorizado." } }, { status: 401 });
  const started = Date.now();
  const expired = await expireReservations();
  const events = await processIntegrationEvents(100);
  const alerts = await generateSearchAlerts();
  const outbox = await processOutbox(50);
  return NextResponse.json({ ok: true, expired, events, alerts, outbox, ms: Date.now() - started }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = run;
export const POST = run;

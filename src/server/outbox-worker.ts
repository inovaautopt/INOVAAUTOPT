import "server-only";
import { createHash } from "node:crypto";
import { asSystem, type Tx } from "@/lib/db";
import { canSendTo, env, siteUrl } from "@/lib/env";
import { emailProvider, layout, type SendResult } from "./email";
import { insideServiceWindow, processEvent, sendWhatsapp } from "./whatsapp";
import { enqueue, type OutboxKind } from "./outbox";
import { formatDateTime, formatPrice } from "@/lib/format";
import { LEAD_KIND_LABEL, type LeadKind } from "@/lib/domain";
import { getBranchSummary } from "./branch-summary";
import { unsubscribeToken } from "./saved-searches";
import { vehicleFilters } from "@/lib/validation";
import { buildWhere } from "@/lib/vehicles";

/**
 * Processamento da outbox (notificações) e dos eventos de integração.
 * Corre por pedido autenticado (/api/cron/outbox) — agendado pela Vercel Cron e/ou pg_cron —
 * e também logo a seguir a cada pedido público (after()), para rapidez.
 * Nada depende de timers em memória: o estado está todo na base de dados.
 */

interface OutboxRow {
  id: string;
  kind: OutboxKind;
  channel: "email" | "whatsapp";
  payload: Record<string, unknown>;
  idempotencyKey: string;
  attempts: number;
  maxAttempts: number;
}

type Outcome = { status: "sent"; providerId: string } | { status: "skipped"; reason: string } | { status: "failed"; error: string; permanent: boolean; uncertain?: boolean };

function backoffSeconds(attempts: number) {
  return Math.min(60 * 2 ** Math.max(0, attempts - 1), 6 * 3600);
}

function staffRecipients(extra: (string | null | undefined)[] = []) {
  const list = (env().STAFF_NOTIFICATION_EMAILS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return [...new Set([...list, ...extra.filter((x): x is string => Boolean(x))])];
}

function allowed(recipients: string[]) {
  return recipients.filter((r) => canSendTo(r));
}

async function sendEmail(row: OutboxRow, to: string[], subject: string, body: { html: string; text: string }): Promise<Outcome> {
  const provider = emailProvider();
  if (!provider) return { status: "skipped", reason: "Email por ativar (EMAIL_PROVIDER=disabled)." };
  const recipients = allowed(to);
  if (recipients.length === 0) return { status: "skipped", reason: "Destinatário fora da lista autorizada neste ambiente." };
  const r: SendResult = await provider.send({ to: recipients, subject, html: body.html, text: body.text, replyTo: env().EMAIL_REPLY_TO, idempotencyKey: row.idempotencyKey });
  return r.ok ? { status: "sent", providerId: r.providerId } : { status: "failed", error: r.error, permanent: r.permanent, uncertain: r.uncertain };
}

async function handle(tx: Tx, row: OutboxRow): Promise<Outcome> {
  const p = row.payload;
  const company = "Inova Auto";
  switch (row.kind) {
    case "lead_received_customer":
    case "appointment_requested_customer": {
      const [l] = (await tx`select id, name, email, vehicle_reference from app.leads where id = ${p.leadId as string}`) as unknown as { id: string; name: string; email: string | null; vehicleReference: string | null }[];
      if (!l?.email) return { status: "skipped", reason: "Contacto sem email." };
      const ref = l.id.slice(0, 8).toUpperCase();
      const visit = row.kind === "appointment_requested_customer";
      const body = layout(
        visit ? "Recebemos o teu pedido de marcação" : "Recebemos o teu pedido",
        [
          `Olá ${l.name.split(" ")[0]},`,
          visit
            ? "Recebemos o teu pedido de visita. Ainda não é uma marcação confirmada: vamos contactar-te para acertar a hora."
            : "Recebemos o teu pedido e vamos responder pelo contacto que indicaste, durante o horário do stand.",
          `Número do pedido: ${ref}${l.vehicleReference ? ` · Viatura ${l.vehicleReference}` : ""}.`,
        ],
        undefined,
        `${company} · Recebeste este email porque fizeste um pedido no nosso site.`,
      );
      return sendEmail(row, [l.email], visit ? "Pedido de marcação recebido" : "Pedido recebido", body);
    }
    case "lead_received_staff": {
      const [l] = (await tx`select l.id, l.name, l.kind, l.vehicle_reference, p.email as assignee_email, p.full_name as assignee
        from app.leads l left join app.profiles p on p.id = l.assigned_to where l.id = ${p.leadId as string}`) as unknown as {
        id: string; name: string; kind: LeadKind; vehicleReference: string | null; assigneeEmail: string | null; assignee: string | null;
      }[];
      if (!l) return { status: "skipped", reason: "Contacto não encontrado." };
      const body = layout(
        `Novo contacto: ${LEAD_KIND_LABEL[l.kind]}`,
        [`${l.name}${l.vehicleReference ? ` · viatura ${l.vehicleReference}` : ""}.`, l.assignee ? `Atribuído a ${l.assignee}.` : "Está na fila central, sem responsável."],
        { label: "Abrir no painel", url: siteUrl(`/admin/contactos/${l.id}`) },
      );
      return sendEmail(row, staffRecipients([l.assigneeEmail]), `Novo contacto${l.vehicleReference ? ` · ${l.vehicleReference}` : ""}`, body);
    }
    case "lead_unanswered_staff": {
      const [l] = (await tx`select l.id, l.name, l.status, l.first_response_at, l.vehicle_reference, p.email as assignee_email
        from app.leads l left join app.profiles p on p.id = l.assigned_to where l.id = ${p.leadId as string}`) as unknown as {
        id: string; name: string; status: string; firstResponseAt: Date | null; vehicleReference: string | null; assigneeEmail: string | null;
      }[];
      if (!l || l.firstResponseAt || !["new", "assigned"].includes(l.status)) return { status: "skipped", reason: "Já respondido." };
      const body = layout("Contacto sem resposta", [`${l.name}${l.vehicleReference ? ` · ${l.vehicleReference}` : ""} ainda não tem resposta registada.`], {
        label: "Responder agora",
        url: siteUrl(`/admin/contactos/${l.id}`),
      });
      return sendEmail(row, staffRecipients([l.assigneeEmail]), "Contacto sem resposta", body);
    }
    case "appointment_confirmed_customer":
    case "appointment_cancelled_customer": {
      const [a] = (await tx`select a.status, a.confirmed_start, a.kind, a.branch_id, l.name, l.email, l.vehicle_reference
        from app.appointments a join app.leads l on l.id = a.lead_id where a.id = ${p.appointmentId as string}`) as unknown as {
        status: string; confirmedStart: Date | null; kind: string; branchId: string | null; name: string; email: string | null; vehicleReference: string | null;
      }[];
      if (!a?.email) return { status: "skipped", reason: "Sem email." };
      const confirmed = row.kind === "appointment_confirmed_customer";
      if (confirmed && (a.status !== "confirmed" || !a.confirmedStart)) return { status: "skipped", reason: "Marcação já não está confirmada." };
      const branch = a.branchId ? await getBranchSummary(tx, a.branchId) : null;
      const what = a.kind === "test_drive" ? "test drive" : "visita";
      const body = confirmed
        ? layout(`A tua ${what} está confirmada`, [
            `Olá ${a.name.split(" ")[0]},`,
            `Ficou marcado para ${formatDateTime(a.confirmedStart)} (hora de Portugal continental)${a.vehicleReference ? `, viatura ${a.vehicleReference}` : ""}.`,
            ...(branch ? [`Local: ${branch}.`] : []),
            "Se precisares de alterar, responde a este email ou contacta o stand.",
          ])
        : layout(`A tua ${what} foi cancelada`, [`Olá ${a.name.split(" ")[0]},`, "A marcação foi cancelada. Se quiseres reagendar, contacta-nos."]);
      return sendEmail(row, [a.email], confirmed ? `Marcação confirmada · ${formatDateTime(a.confirmedStart)}` : "Marcação cancelada", body);
    }
    case "saved_search_verify": {
      const [sv] = (await tx`select id, email, status from app.saved_searches where id = ${p.savedSearchId as string}`) as unknown as { id: string; email: string; status: string }[];
      if (!sv || sv.status !== "pending" || !p.verifyToken) return { status: "skipped", reason: "Alerta já confirmado ou cancelado." };
      const body = layout(
        "Confirma o teu alerta de viaturas",
        ["Pediste para receber um email quando entrar no stand uma viatura com os critérios que escolheste. Confirma para ativar.", "Se não foste tu, ignora este email."],
        { label: "Confirmar alerta", url: siteUrl(`/alertas/confirmar?token=${encodeURIComponent(p.verifyToken as string)}`) },
        `Para cancelar: ${siteUrl(`/alertas/cancelar?token=${encodeURIComponent(unsubscribeToken(sv.id))}`)}`,
      );
      return sendEmail(row, [sv.email], "Confirma o teu alerta de viaturas", body);
    }
    case "search_alert": {
      const [sv] = (await tx`select id, email, status from app.saved_searches where id = ${p.savedSearchId as string}`) as unknown as { id: string; email: string; status: string }[];
      if (!sv || sv.status !== "active") return { status: "skipped", reason: "Alerta inativo." };
      const vehicles = (await tx`select slug, make, model, version_name, price_cents from app.vehicles where id in ${tx(p.vehicleIds as string[])} and status = 'available'`) as unknown as {
        slug: string; make: string; model: string; versionName: string | null; priceCents: number | null;
      }[];
      if (vehicles.length === 0) return { status: "skipped", reason: "Viaturas já indisponíveis." };
      const body = layout(
        vehicles.length === 1 ? "Chegou uma viatura que procuras" : `Chegaram ${vehicles.length} viaturas que procuras`,
        vehicles.map((v) => `${v.make} ${v.model}${v.versionName ? ` ${v.versionName}` : ""} — ${formatPrice(v.priceCents)} — ${siteUrl(`/viaturas/${v.slug}`)}`),
        { label: "Ver viaturas", url: siteUrl("/viaturas") },
        `Cancelar este alerta: ${siteUrl(`/alertas/cancelar?token=${encodeURIComponent(unsubscribeToken(sv.id))}`)}`,
      );
      return sendEmail(row, [sv.email], "Novas viaturas no stand", body);
    }
    case "whatsapp_message": {
      const [m] = (await tx`select m.id, m.body, m.template_name, m.template_language, m.status, m.provider_message_id, c.contact_phone_e164, c.last_inbound_at, c.opted_out_at
        from app.messages m join app.conversations c on c.id = m.conversation_id where m.id = ${p.messageId as string}`) as unknown as {
        id: string; body: string | null; templateName: string | null; templateLanguage: string | null; status: string; providerMessageId: string | null;
        contactPhoneE164: string | null; lastInboundAt: Date | null; optedOutAt: Date | null;
      }[];
      if (!m || !m.contactPhoneE164) return { status: "skipped", reason: "Mensagem não encontrada." };
      if (m.providerMessageId || m.status !== "pending") return { status: "skipped", reason: "Já processada." };
      if (m.optedOutAt) {
        await tx`update app.messages set status = 'failed', error_message = 'Cliente pediu para não ser contactado' where id = ${m.id}`;
        return { status: "skipped", reason: "Opt-out." };
      }
      if (!m.templateName && !insideServiceWindow(m.lastInboundAt)) {
        await tx`update app.messages set status = 'failed', error_message = 'Fora da janela de atendimento: usar template aprovado' where id = ${m.id}`;
        return { status: "skipped", reason: "Fora da janela de 24 h." };
      }
      if (!canSendTo(m.contactPhoneE164)) {
        await tx`update app.messages set status = 'failed', error_message = 'Destinatário não autorizado neste ambiente' where id = ${m.id}`;
        return { status: "skipped", reason: "Fora da lista autorizada." };
      }
      const r = await sendWhatsapp({
        to: m.contactPhoneE164,
        ...(m.templateName ? { template: { name: m.templateName, language: m.templateLanguage ?? "pt_PT", bodyParams: (p.bodyParams as string[]) ?? [] } } : { text: m.body ?? "" }),
      });
      if (r.ok) {
        await tx`update app.messages set status = 'accepted', provider_message_id = ${r.providerId}, status_at = now() where id = ${m.id}`;
        return { status: "sent", providerId: r.providerId };
      }
      // Resultado incerto: marca e NÃO reenvia (pode já ter sido aceite); a confirmação chega por webhook
      await tx`update app.messages set status = ${r.uncertain ? "uncertain" : r.permanent ? "failed" : "pending"}, error_message = ${r.error} where id = ${m.id}`;
      return { status: "failed", error: r.error, permanent: r.permanent || r.uncertain, uncertain: r.uncertain };
    }
    default:
      return { status: "skipped", reason: `Tipo desconhecido: ${row.kind}` };
  }
}

export async function processOutbox(limit = 20): Promise<{ sent: number; failed: number; skipped: number }> {
  const rows = await asSystem((tx) => tx`select * from app.claim_outbox(${limit})` as unknown as Promise<OutboxRow[]>);
  const stats = { sent: 0, failed: 0, skipped: 0 };
  for (const row of rows) {
    let outcome: Outcome;
    try {
      outcome = await asSystem((tx) => handle(tx, row));
    } catch (err) {
      outcome = { status: "failed", error: (err as Error).message.slice(0, 300), permanent: false };
    }
    await asSystem(async (tx) => {
      if (outcome.status === "sent") {
        stats.sent++;
        // Remove tokens em claro do payload depois de enviados
        await tx`update app.notification_outbox set status = 'sent', sent_at = now(), provider_message_id = ${outcome.providerId}, last_error = null,
                 payload = payload - 'verifyToken' where id = ${row.id}`;
      } else if (outcome.status === "skipped") {
        stats.skipped++;
        await tx`update app.notification_outbox set status = 'skipped', last_error = ${outcome.reason}, payload = payload - 'verifyToken' where id = ${row.id}`;
      } else {
        stats.failed++;
        const dead = outcome.permanent || row.attempts >= row.maxAttempts;
        await tx`update app.notification_outbox set status = ${dead ? "dead" : "failed"}, last_error = ${outcome.error.slice(0, 500)},
                 next_attempt_at = now() + make_interval(secs => ${backoffSeconds(row.attempts)}) where id = ${row.id}`;
      }
    });
  }
  return stats;
}

/** Processa eventos de webhook persistidos (em transações separadas, um a um). */
export async function processIntegrationEvents(limit = 50) {
  const events = await asSystem(
    (tx) =>
      tx`select id, provider, payload, attempts from app.integration_events
         where status in ('received', 'failed') and attempts < 20 order by received_at limit ${limit}` as unknown as Promise<{ id: string; provider: string; payload: Record<string, unknown>; attempts: number }[]>,
  );
  let processed = 0;
  for (const ev of events) {
    try {
      const result = await asSystem((tx) => (ev.provider === "whatsapp" ? processEvent(tx, ev.payload) : Promise.resolve("ignored" as const)));
      await asSystem(
        (tx) =>
          tx`update app.integration_events set status = ${result === "retry" ? (ev.attempts >= 19 ? "ignored" : "received") : result},
             attempts = attempts + 1, processed_at = case when ${result} = 'retry' then null else now() end where id = ${ev.id}`,
      );
      if (result === "processed") processed++;
    } catch (err) {
      await asSystem((tx) => tx`update app.integration_events set status = 'failed', attempts = attempts + 1, error = ${(err as Error).message.slice(0, 500)} where id = ${ev.id}`);
    }
  }
  return { processed, total: events.length };
}

/** Gera alertas de pesquisas guardadas para viaturas publicadas desde a última verificação. */
export async function generateSearchAlerts() {
  return asSystem(async (tx) => {
    const searches = (await tx`select id, criteria, coalesce(last_checked_at, verified_at) as since from app.saved_searches where status = 'active' limit 500`) as unknown as {
      id: string; criteria: Record<string, string>; since: Date;
    }[];
    let queued = 0;
    for (const s of searches) {
      const f = vehicleFilters.parse(s.criteria);
      const where = buildWhere(tx, f);
      const found = (await tx`select v.id from app.vehicles v left join app.branches b on b.id = v.branch_id
        where ${where} and v.status = 'available' and v.published_at > ${s.since} and not v.is_demo order by v.id limit 10`) as unknown as { id: string }[];
      if (found.length) {
        const ids = found.map((x) => x.id);
        const key = createHash("sha256").update(ids.join(",")).digest("hex").slice(0, 16);
        await enqueue(tx, { kind: "search_alert", channel: "email", payload: { savedSearchId: s.id, vehicleIds: ids }, idempotencyKey: `alert:${s.id}:${key}` });
        queued++;
      }
      await tx`update app.saved_searches set last_checked_at = now() where id = ${s.id}`;
    }
    return { searches: searches.length, queued };
  });
}

export async function expireReservations() {
  return asSystem(async (tx) => {
    const [r] = (await tx`select app.expire_reservations() as n`) as unknown as [{ n: number }];
    return r.n;
  });
}

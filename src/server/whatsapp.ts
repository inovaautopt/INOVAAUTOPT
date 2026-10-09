import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import type { Tx } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { CONSENT_TEXT_VERSION } from "@/lib/validation";

/**
 * WhatsApp Business Platform — Cloud API oficial da Meta.
 * Sem bibliotecas que automatizam o WhatsApp Web, sem sessões por QR code, sem APIs não oficiais.
 *
 * O botão Click to Chat (wa.me) do site é um mecanismo SEPARADO: abre o WhatsApp do visitante
 * e não passa por aqui.
 */

export const SERVICE_WINDOW_HOURS = 24; // Janela de atendimento definida pela Meta (confirmar nas políticas atuais)
const OPT_OUT_WORDS = /^\s*(stop|parar|cancelar|sair|remover|unsubscribe)\s*[.!]*\s*$/i;

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

/** GET de verificação: compara hub.verify_token e devolve hub.challenge. */
export function verifySubscription(params: URLSearchParams): string | null {
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  const expected = env().WHATSAPP_VERIFY_TOKEN;
  if (mode !== "subscribe" || !token || !challenge || !expected) return null;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return challenge;
}

/**
 * POST: valida X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(app secret, corpo BRUTO).
 * O verify token do GET NÃO substitui esta validação.
 */
export function verifySignature(rawBody: Buffer, header: string | null, secret = env().META_APP_SECRET): boolean {
  if (!header || !secret || !header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  let got: Buffer;
  try {
    got = Buffer.from(header.slice(7), "hex");
  } catch {
    return false;
  }
  return got.length === expected.length && timingSafeEqual(got, expected);
}

interface WaMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: unknown;
}

interface WaPayload {
  object?: string;
  entry?: {
    id?: string;
    changes?: {
      field?: string;
      value?: {
        metadata?: { phone_number_id?: string; display_phone_number?: string };
        contacts?: { wa_id?: string; profile?: { name?: string } }[];
        messages?: WaMessage[];
        statuses?: { id: string; status: string; timestamp: string; recipient_id?: string; errors?: { code?: number; title?: string; message?: string }[] }[];
      };
    }[];
  }[];
}

export interface WaEvent {
  key: string;
  payload: Record<string, unknown>;
}

/** Divide o lote recebido em eventos individuais com chave de deduplicação estável. */
export function splitEvents(body: WaPayload, rawHash: string): WaEvent[] {
  const events: WaEvent[] = [];
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value ?? {};
      if (v.metadata?.phone_number_id && env().WHATSAPP_PHONE_NUMBER_ID && v.metadata.phone_number_id !== env().WHATSAPP_PHONE_NUMBER_ID) continue; // outro número
      const contactName = new Map((v.contacts ?? []).map((c) => [c.wa_id, c.profile?.name]));
      for (const m of v.messages ?? []) {
        events.push({ key: `msg:${m.id}`, payload: { type: "message", message: m, contactName: contactName.get(m.from) ?? null } });
      }
      for (const s of v.statuses ?? []) {
        events.push({ key: `status:${s.id}:${s.status}:${s.timestamp}`, payload: { type: "status", status: s } });
      }
    }
  }
  if (events.length === 0) events.push({ key: `other:${rawHash}`, payload: { type: "other", body } });
  return events;
}

export function hashBody(raw: Buffer) {
  return createHash("sha256").update(raw).digest("hex");
}

const STATUS_RANK: Record<string, number> = { pending: 0, uncertain: 0, accepted: 1, sent: 2, delivered: 3, read: 4, failed: 5, received: 0 };

/** Processa um evento já persistido. Idempotente e tolerante a eventos fora de ordem. */
export async function processEvent(tx: Tx, payload: Record<string, unknown>): Promise<"processed" | "retry" | "ignored"> {
  if (payload.type === "message") {
    const m = payload.message as WaMessage;
    const waId = m.from;
    const phone = normalizePhone(`+${waId}`);
    const at = new Date(Number(m.timestamp) * 1000);
    const text = m.text?.body ?? m.button?.text ?? `[${m.type}]`;

    const [conv] = (await tx`
      insert into app.conversations (contact_wa_id, contact_phone_e164, contact_name, last_inbound_at, last_message_at)
      values (${waId}, ${phone}, ${(payload.contactName as string | null) ?? null}, ${at}, ${at})
      on conflict (channel, contact_wa_id) do update set
        contact_name = coalesce(excluded.contact_name, app.conversations.contact_name),
        last_inbound_at = greatest(app.conversations.last_inbound_at, excluded.last_inbound_at),
        last_message_at = greatest(app.conversations.last_message_at, excluded.last_message_at),
        status = 'open'
      returning id, lead_id, assigned_to`) as unknown as { id: string; leadId: string | null; assignedTo: string | null }[];

    const inserted = await tx`insert into app.messages (conversation_id, direction, provider_message_id, message_type, body, status, status_at, provider_timestamp)
      values (${conv!.id}, 'inbound', ${m.id}, ${m.type}, ${text.slice(0, 4096)}, 'received', ${at}, ${at})
      on conflict (provider_message_id) do nothing returning id`;
    if (inserted.length === 0) return "ignored"; // duplicado

    // Pedido de interrupção: regista retirada de autorização e bloqueia envios
    if (OPT_OUT_WORDS.test(text) && phone) {
      await tx`update app.conversations set opted_out_at = now() where id = ${conv!.id}`;
      await tx`insert into app.contact_permissions (lead_id, contact_value, channel, purpose, status, text_version, source)
               values (${conv!.leadId}, ${phone}, 'whatsapp', 'whatsapp_contact', 'withdrawn', ${CONSENT_TEXT_VERSION}, 'whatsapp:pedido de interrupção')`;
    } else {
      // Quem escreve volta a abrir a conversa
      await tx`update app.conversations set opted_out_at = null where id = ${conv!.id} and opted_out_at is not null`;
    }

    // Associação a contacto do CRM: por telefone; se não existir, cria um contacto de origem WhatsApp.
    let leadId = conv!.leadId;
    if (!leadId && phone) {
      const [existing] = (await tx`select id, assigned_to from app.leads where phone_e164 = ${phone} and status not in ('won', 'lost', 'archived') order by created_at desc limit 1`) as unknown as { id: string; assignedTo: string | null }[];
      if (existing) leadId = existing.id;
      else {
        // Tentativa de associar a viatura pela referência no texto (pode falhar se o cliente apagou a referência)
        const ref = text.match(/\bIA-\d{4}\b/i)?.[0]?.toUpperCase() ?? null;
        const [veh] = ref ? ((await tx`select id, reference from app.vehicles where reference = ${ref}`) as unknown as { id: string; reference: string }[]) : [];
        const [lead] = (await tx`insert into app.leads (kind, source, name, phone_e164, message, vehicle_id, vehicle_reference)
          values ('whatsapp', 'whatsapp', ${((payload.contactName as string | null) ?? "Contacto WhatsApp").slice(0, 120)}, ${phone}, ${text.slice(0, 4000)}, ${veh?.id ?? null}, ${veh?.reference ?? null})
          returning id`) as unknown as { id: string }[];
        leadId = lead!.id;
        await tx`insert into app.lead_activities (lead_id, kind, body) values (${leadId}, 'created', 'Conversa iniciada pelo cliente no WhatsApp')`;
        await tx`select app.auto_assign_lead(${leadId})`;
      }
      const [l] = (await tx`select assigned_to from app.leads where id = ${leadId}`) as unknown as { assignedTo: string | null }[];
      await tx`update app.conversations set lead_id = ${leadId}, assigned_to = coalesce(assigned_to, ${l?.assignedTo ?? null}) where id = ${conv!.id}`;
    }
    if (leadId) {
      await tx`insert into app.lead_activities (lead_id, kind, body, meta) values (${leadId}, 'whatsapp', ${`Mensagem recebida: ${text.slice(0, 500)}`}, ${tx.json({ direction: "inbound" })})`;
    }
    return "processed";
  }

  if (payload.type === "status") {
    const s = payload.status as { id: string; status: string; timestamp: string; errors?: { code?: number; title?: string; message?: string }[] };
    const at = new Date(Number(s.timestamp) * 1000);
    const [msg] = (await tx`select id, status from app.messages where provider_message_id = ${s.id}`) as unknown as { id: string; status: string }[];
    if (!msg) return "retry"; // o estado pode chegar antes de gravarmos o id do fornecedor
    const newRank = STATUS_RANK[s.status] ?? -1;
    if (newRank < 0) return "ignored";
    // Só avança (eventos fora de ordem não fazem regredir), exceto "failed"
    if (s.status === "failed" || newRank > (STATUS_RANK[msg.status] ?? 0)) {
      const e = s.errors?.[0];
      await tx`update app.messages set status = ${s.status}, status_at = ${at},
               error_code = ${e?.code != null ? String(e.code) : null}, error_message = ${e ? `${e.title ?? ""} ${e.message ?? ""}`.trim() : null}
               where id = ${msg.id}`;
    }
    return "processed";
  }
  return "ignored";
}

// ---------------------------------------------------------------------------
// Envio
// ---------------------------------------------------------------------------
export type WaSendResult = { ok: true; providerId: string } | { ok: false; permanent: boolean; uncertain: boolean; error: string };

export interface WaOutgoing {
  to: string; // E.164
  text?: string;
  template?: { name: string; language: string; bodyParams: string[] };
}

export async function sendWhatsapp(msg: WaOutgoing): Promise<WaSendResult> {
  const provider = env().WHATSAPP_PROVIDER;
  if (provider === "disabled") return { ok: false, permanent: true, uncertain: false, error: "WhatsApp Cloud API por ativar." };
  if (provider === "mock") return { ok: true, providerId: `wamid.mock.${Date.now()}` };
  const e = env();
  const url = `https://graph.facebook.com/${e.WHATSAPP_GRAPH_API_VERSION}/${e.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const body = msg.template
    ? {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: msg.to.replace(/\D/g, ""),
        type: "template",
        template: {
          name: msg.template.name,
          language: { code: msg.template.language },
          ...(msg.template.bodyParams.length ? { components: [{ type: "body", parameters: msg.template.bodyParams.map((t) => ({ type: "text", text: t })) }] } : {}),
        },
      }
    : { messaging_product: "whatsapp", recipient_type: "individual", to: msg.to.replace(/\D/g, ""), type: "text", text: { body: msg.text, preview_url: false } };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${e.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { code?: number; message?: string } };
    if (res.ok && json.messages?.[0]?.id) return { ok: true, providerId: json.messages[0].id };
    const code = json.error?.code;
    // 4xx de validação/política = permanente; 429/5xx = temporário
    const permanent = res.status >= 400 && res.status < 500 && res.status !== 429;
    return { ok: false, permanent, uncertain: false, error: `Meta ${res.status}${code ? ` (${code})` : ""}: ${json.error?.message ?? ""}`.slice(0, 500) };
  } catch (err) {
    // Resultado incerto: a mensagem pode ter sido aceite. NÃO reenviar às cegas.
    return { ok: false, permanent: false, uncertain: true, error: ctrl.signal.aborted ? "Tempo esgotado (resultado incerto)" : (err as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

export function insideServiceWindow(lastInboundAt: Date | null, now = new Date()): boolean {
  if (!lastInboundAt) return false;
  return now.getTime() - new Date(lastInboundAt).getTime() < SERVICE_WINDOW_HOURS * 3600_000;
}

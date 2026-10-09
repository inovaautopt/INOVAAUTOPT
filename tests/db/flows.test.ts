import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { asSystem, sql } from "@/lib/db";

/**
 * Fluxos ponta a ponta no servidor: pedido público → CRM → outbox, falha de notificação,
 * webhook WhatsApp (duplicados e estados fora de ordem).
 */
const BRANCH = "21000000-0000-4000-8000-000000000001";
const VEH = "31000000-0000-4000-8000-000000000001";

beforeAll(async () => {
  await asSystem(async (tx) => {
    await tx`insert into app.branches (id, name, slug, opening_hours) values (${BRANCH}, 'Stand Fluxos', 'stand-fluxos',
      '{"mon":[["09:00","13:00"],["14:00","19:00"]],"tue":[["09:00","19:00"]],"wed":[["09:00","19:00"]],"thu":[["09:00","19:00"]],"fri":[["09:00","19:00"]]}') on conflict do nothing`;
    await tx`insert into app.vehicles (id, slug, status, branch_id, make, model, price_cents, vat_regime, first_registration_year, mileage_km, fuel, transmission)
             values (${VEH}, 'fiat-500e-fluxo', 'available', ${BRANCH}, 'Fiat', '500e', 1890000, 'margin_scheme', 2022, 41376, 'electric', 'automatic') on conflict do nothing`;
  });
});

afterAll(async () => {
  vi.restoreAllMocks();
  await sql().end();
});

const base = (over: Record<string, unknown> = {}) => ({
  name: "Cliente Teste",
  email: "cliente@example.com",
  phone: "+351912345678",
  allowWhatsapp: false,
  allowMarketing: false,
  idempotencyKey: randomUUID(),
  pageUrl: undefined as string | undefined,
  message: undefined as string | undefined,
  preferredChannel: undefined,
  website: undefined,
  startedAt: undefined,
  ...over,
});

describe("pedido de informação", () => {
  it("grava contacto, autorizações, atividade e notificações numa transação; é idempotente", async () => {
    const { createInfoLead } = await import("@/server/leads");
    const input = { ...base({ allowWhatsapp: true }), kind: "info" as const, vehicleId: VEH, message: "Disponível?" };
    const r1 = await createInfoLead(input);
    const r2 = await createInfoLead(input);
    expect(r1.created).toBe(true);
    expect(r2.created).toBe(false);
    expect(r2.leadId).toBe(r1.leadId);
    const rows = await asSystem(async (tx) => ({
      perms: await tx`select purpose, status from app.contact_permissions where lead_id = ${r1.leadId} order by purpose`,
      outbox: await tx`select kind from app.notification_outbox where payload->>'leadId' = ${r1.leadId} order by kind`,
      lead: (await tx`select vehicle_reference, status from app.leads where id = ${r1.leadId}`)[0],
    }));
    expect(rows.perms.map((p) => p.purpose)).toEqual(["request_response", "whatsapp_contact"]);
    expect(rows.outbox.map((o) => o.kind)).toEqual(["lead_received_customer", "lead_received_staff", "lead_unanswered_staff"]);
    expect(rows.lead!.vehicleReference).toMatch(/^IA-\d{4}$/);
  });

  it("recusa pedidos para viaturas não publicadas", async () => {
    const { createInfoLead, PublicRequestError } = await import("@/server/leads");
    await expect(createInfoLead({ ...base(), kind: "info", vehicleId: randomUUID() })).rejects.toBeInstanceOf(PublicRequestError);
  });

  it("se o email falhar, o pedido continua no CRM e a notificação fica para nova tentativa", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Teste <t@example.com>";
    vi.resetModules();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("rede em baixo"));
    const { createInfoLead } = await import("@/server/leads");
    const { processOutbox } = await import("@/server/outbox-worker");
    const r = await createInfoLead({ ...base(), kind: "info" });
    const stats = await processOutbox(50);
    expect(stats.failed).toBeGreaterThan(0);
    const [lead] = await asSystem((tx) => tx`select id from app.leads where id = ${r.leadId}`);
    expect(lead).toBeDefined();
    const [ob] = await asSystem((tx) => tx`select status, attempts, next_attempt_at > now() as later from app.notification_outbox where payload->>'leadId' = ${r.leadId} and kind = 'lead_received_customer'`);
    expect(ob).toMatchObject({ status: "failed", attempts: 1, later: true });
    fetchMock.mockRestore();
    process.env.EMAIL_PROVIDER = "log";
    vi.resetModules();
  });
});

describe("marcação de visita", () => {
  it("recusa dias em que o stand está fechado e aceita dias abertos", async () => {
    const { createAppointmentRequest, PublicRequestError } = await import("@/server/leads");
    // próximo domingo (fechado)
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7 || 7));
    const sunday = d.toISOString().slice(0, 10);
    await expect(createAppointmentRequest({ ...base(), branchId: BRANCH, kind: "visit", requestedDate: sunday, requestedPeriod: "morning" })).rejects.toBeInstanceOf(PublicRequestError);
    const monday = new Date(d.getTime() + 86400000).toISOString().slice(0, 10);
    const r = await createAppointmentRequest({ ...base(), branchId: BRANCH, vehicleId: VEH, kind: "test_drive", requestedDate: monday, requestedPeriod: "afternoon" });
    const [a] = await asSystem((tx) => tx`select status from app.appointments where lead_id = ${r.leadId}`);
    expect(a!.status).toBe("requested"); // pedido, não reserva confirmada
  });
});

describe("webhook WhatsApp", () => {
  it("mensagem recebida cria conversa e contacto; duplicado é ignorado; estados fora de ordem não regridem", async () => {
    const { processEvent } = await import("@/server/whatsapp");
    const msg = { type: "message", contactName: "Rita", message: { id: "wamid.IN1", from: "351936000111", timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: "Olá, a IA-0001 ainda está disponível?" } } };
    expect(await asSystem((tx) => processEvent(tx, msg))).toBe("processed");
    expect(await asSystem((tx) => processEvent(tx, msg))).toBe("ignored");
    const [conv] = await asSystem((tx) => tx`select c.id, c.lead_id, l.source from app.conversations c join app.leads l on l.id = c.lead_id where c.contact_wa_id = '351936000111'`);
    expect(conv!.source).toBe("whatsapp");

    await asSystem((tx) => tx`insert into app.messages (conversation_id, direction, body, status, provider_message_id) values (${conv!.id}, 'outbound', 'Sim!', 'accepted', 'wamid.OUT1')`);
    const st = (s: string, t: number) => ({ type: "status", status: { id: "wamid.OUT1", status: s, timestamp: String(t) } });
    await asSystem((tx) => processEvent(tx, st("read", 300)));
    await asSystem((tx) => processEvent(tx, st("delivered", 200))); // chega depois, mas é anterior
    const [m] = await asSystem((tx) => tx`select status from app.messages where provider_message_id = 'wamid.OUT1'`);
    expect(m!.status).toBe("read");
    // estado de mensagem ainda desconhecida: pede nova tentativa
    expect(await asSystem((tx) => processEvent(tx, { type: "status", status: { id: "wamid.UNKNOWN", status: "sent", timestamp: "1" } }))).toBe("retry");
  });

  it("pedido de paragem regista retirada de autorização", async () => {
    const { processEvent } = await import("@/server/whatsapp");
    await asSystem((tx) => processEvent(tx, { type: "message", contactName: null, message: { id: "wamid.STOP", from: "351936000111", timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: "PARAR" } } }));
    const [c] = await asSystem((tx) => tx`select opted_out_at from app.conversations where contact_wa_id = '351936000111'`);
    expect(c!.optedOutAt).not.toBeNull();
  });
});

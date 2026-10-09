import "server-only";
import { asSystem, type Tx } from "@/lib/db";
import { isProduction } from "@/lib/env";
import type { AppointmentInput, LeadInput, TradeInInput } from "@/lib/validation";
import { CONSENT_TEXT_VERSION } from "@/lib/validation";
import { readSettings } from "@/lib/settings";
import { enqueue } from "./outbox";
import { todayInLisbon, weekdayKey } from "@/lib/format";

export class PublicRequestError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

interface VehicleRef {
  id: string;
  reference: string;
  status: string;
  make: string;
  model: string;
}

async function loadPublishedVehicle(tx: Tx, vehicleId: string | undefined): Promise<VehicleRef | null> {
  if (!vehicleId) return null;
  const [v] = (await tx`
    select id, reference, status, make, model from app.vehicles
    where id = ${vehicleId} and status in ('available', 'reserved', 'sold') and published_at is not null
      ${isProduction() ? tx`and not is_demo` : tx``}
  `) as unknown as VehicleRef[];
  if (!v) throw new PublicRequestError("Esta viatura já não está disponível no site.", "vehicleId");
  return v;
}

export function publicReference(id: string) {
  return id.slice(0, 8).toUpperCase();
}

interface BaseLead {
  kind: "info" | "visit" | "trade_in" | "financing";
  vehicle: VehicleRef | null;
  input: LeadInput | AppointmentInput | TradeInInput;
  message?: string;
}

/**
 * Grava o contacto, as autorizações, a atividade e as notificações numa só transação.
 * Idempotente: o mesmo idempotencyKey devolve o mesmo pedido sem duplicar.
 */
async function insertLead(tx: Tx, base: BaseLead): Promise<{ leadId: string; created: boolean }> {
  const { input } = base;
  const [existing] = (await tx`select id from app.leads where idempotency_key = ${input.idempotencyKey}`) as unknown as { id: string }[];
  if (existing) return { leadId: existing.id, created: false };

  const [lead] = (await tx`
    insert into app.leads (kind, source, vehicle_id, vehicle_reference, name, email, phone_e164, preferred_channel,
                           message, idempotency_key, page_url, is_demo)
    values (${base.kind}, 'website', ${base.vehicle?.id ?? null}, ${base.vehicle?.reference ?? null}, ${input.name},
            ${input.email ?? null}, ${input.phone ?? null}, ${input.preferredChannel ?? null}, ${base.message ?? null},
            ${input.idempotencyKey}, ${input.pageUrl ?? null}, false)
    on conflict (idempotency_key) do nothing
    returning id
  `) as unknown as { id: string }[];
  if (!lead) {
    const [again] = (await tx`select id from app.leads where idempotency_key = ${input.idempotencyKey}`) as unknown as { id: string }[];
    return { leadId: again!.id, created: false };
  }
  const leadId = lead.id;
  const source = `website:${input.pageUrl ?? "/"}`.slice(0, 300);

  // Resposta ao pedido: fundamento = diligências pré-contratuais a pedido do titular (não depende de consentimento)
  const responseChannel = input.preferredChannel ?? (input.email ? "email" : "phone");
  const responseContact = responseChannel === "email" ? input.email : input.phone;
  if (responseContact) {
    await tx`insert into app.contact_permissions (lead_id, contact_value, channel, purpose, status, text_version, source)
             values (${leadId}, ${responseContact}, ${responseChannel}, 'request_response', 'granted', ${CONSENT_TEXT_VERSION}, ${source})`;
  }
  if (input.allowWhatsapp && input.phone) {
    await tx`insert into app.contact_permissions (lead_id, contact_value, channel, purpose, status, text_version, source)
             values (${leadId}, ${input.phone}, 'whatsapp', 'whatsapp_contact', 'granted', ${CONSENT_TEXT_VERSION}, ${source})`;
  }
  if (input.allowMarketing) {
    const contact = input.email ?? input.phone!;
    await tx`insert into app.contact_permissions (lead_id, contact_value, channel, purpose, status, text_version, source)
             values (${leadId}, ${contact}, ${input.email ? "email" : "phone"}, 'marketing', 'granted', ${CONSENT_TEXT_VERSION}, ${source})`;
  }

  await tx`insert into app.lead_activities (lead_id, kind, body, meta)
           values (${leadId}, 'created', 'Pedido recebido pelo site', ${tx.json({ kind: base.kind, vehicle: base.vehicle?.reference ?? null })})`;

  await tx`select app.auto_assign_lead(${leadId})`;

  const { crm } = await readSettings(tx, ["crm"]);
  if (input.email) {
    await enqueue(tx, {
      kind: base.kind === "visit" ? "appointment_requested_customer" : "lead_received_customer",
      channel: "email",
      payload: { leadId },
      idempotencyKey: `lead:${leadId}:customer_ack`,
    });
  }
  await enqueue(tx, { kind: "lead_received_staff", channel: "email", payload: { leadId }, idempotencyKey: `lead:${leadId}:staff_new` });
  await enqueue(tx, {
    kind: "lead_unanswered_staff",
    channel: "email",
    payload: { leadId },
    idempotencyKey: `lead:${leadId}:unanswered`,
    delaySeconds: crm.unansweredAlertMinutes * 60,
  });
  return { leadId, created: true };
}

export async function createInfoLead(input: LeadInput) {
  return asSystem(async (tx) => {
    const vehicle = await loadPublishedVehicle(tx, input.vehicleId);
    const res = await insertLead(tx, { kind: input.kind, vehicle, input, message: input.message });
    return { ...res, reference: publicReference(res.leadId) };
  });
}

/** Verifica se a data/período pedidos estão dentro do horário da instalação e sem encerramento. */
export async function checkAppointmentAvailability(tx: Tx, branchId: string, date: string, period: "morning" | "afternoon") {
  const [branch] = (await tx`select id, opening_hours from app.branches where id = ${branchId} and is_active
    ${isProduction() ? tx`and not is_demo` : tx``}`) as unknown as { id: string; openingHours: Record<string, [string, string][]> }[];
  if (!branch) throw new PublicRequestError("Escolhe uma instalação válida.", "branchId");
  const today = todayInLisbon();
  if (date < today) throw new PublicRequestError("Escolhe uma data a partir de hoje.", "requestedDate");
  const max = new Date(`${today}T12:00:00Z`);
  max.setUTCDate(max.getUTCDate() + 60);
  if (date > max.toISOString().slice(0, 10)) throw new PublicRequestError("Escolhe uma data nos próximos 60 dias.", "requestedDate");
  const [closed] = (await tx`select 1 from app.branch_closures where branch_id = ${branchId} and closed_on = ${date}`) as unknown as unknown[];
  if (closed) throw new PublicRequestError("O stand está fechado nesse dia. Escolhe outra data.", "requestedDate");
  const intervals = branch.openingHours?.[weekdayKey(date)] ?? [];
  // Manhã: o stand abre antes das 13:00. Tarde: o stand está aberto depois das 13:00.
  const fits = period === "morning" ? intervals.some(([start]) => start < "13:00") : intervals.some(([, end]) => end > "13:00");
  if (intervals.length === 0 || !fits) throw new PublicRequestError("O stand não está aberto nesse dia ou período.", "requestedPeriod");
}

export async function createAppointmentRequest(input: AppointmentInput) {
  return asSystem(async (tx) => {
    const vehicle = await loadPublishedVehicle(tx, input.vehicleId);
    if (vehicle && vehicle.status === "sold") {
      throw new PublicRequestError("Esta viatura já foi vendida. Podemos ajudar-te a encontrar uma alternativa.", "vehicleId");
    }
    await checkAppointmentAvailability(tx, input.branchId, input.requestedDate, input.requestedPeriod);
    const res = await insertLead(tx, { kind: "visit", vehicle, input, message: input.message });
    if (res.created) {
      await tx`insert into app.appointments (lead_id, vehicle_id, branch_id, kind, requested_date, requested_period)
               values (${res.leadId}, ${vehicle?.id ?? null}, ${input.branchId}, ${input.kind}, ${input.requestedDate}, ${input.requestedPeriod})`;
      await tx`insert into app.lead_activities (lead_id, kind, body, meta)
               values (${res.leadId}, 'appointment', 'Pedido de marcação (por confirmar)',
                       ${tx.json({ date: input.requestedDate, period: input.requestedPeriod, kind: input.kind })})`;
    }
    return { ...res, reference: publicReference(res.leadId) };
  });
}

export async function createTradeInRequest(input: TradeInInput, photos: { path: string; mime: string; size: number }[]) {
  return asSystem(async (tx) => {
    const vehicle = await loadPublishedVehicle(tx, input.vehicleId);
    const res = await insertLead(tx, { kind: "trade_in", vehicle, input, message: input.message });
    if (res.created) {
      const [t] = (await tx`insert into app.trade_in_requests (lead_id, make, model, year, mileage_km, fuel, condition_text)
               values (${res.leadId}, ${input.make}, ${input.model}, ${input.year}, ${input.mileageKm}, ${input.fuel}, ${input.condition ?? null})
               returning id`) as unknown as { id: string }[];
      for (const p of photos) {
        await tx`insert into app.trade_in_media (trade_in_id, storage_path, mime_type, size_bytes) values (${t!.id}, ${p.path}, ${p.mime}, ${p.size})`;
      }
    }
    return { ...res, reference: publicReference(res.leadId) };
  });
}

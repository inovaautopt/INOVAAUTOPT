"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthError, withStaff } from "@/server/auth";
import { ConflictError, dbErrorMessage } from "@/lib/db";
import { LEAD_STATUSES } from "@/lib/domain";
import { normalizePhone } from "@/lib/phone";
import { lisbonLocalToUtc } from "@/lib/format";
import { enqueue } from "@/server/outbox";
import { CONSENT_TEXT_VERSION } from "@/lib/validation";
import type { ActionState } from "@/components/admin/ActionForm";

const CRM = ["admin", "sales"] as const;

function fail(err: unknown): ActionState {
  if (err instanceof AuthError || err instanceof ConflictError) return { ok: false, message: err.message };
  const m = dbErrorMessage(err);
  if (m) return { ok: false, message: m };
  console.error("admin/contactos", (err as Error).message);
  return { ok: false, message: "Não foi possível guardar. Tenta novamente." };
}

const RESPONSE_KINDS = new Set(["call", "email", "whatsapp", "proposal"]);

export async function addActivityAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  const leadId = String(fd.get("leadId"));
  const kind = z.enum(["note", "call", "email", "whatsapp", "proposal"]).safeParse(fd.get("kind"));
  const body = String(fd.get("body") ?? "").trim().slice(0, 4000);
  if (!kind.success) return { ok: false, message: "Tipo inválido." };
  if (!body) return { ok: false, fields: { body: "Escreve a nota." } };
  try {
    await withStaff([...CRM], async (tx, s) => {
      await tx`insert into app.lead_activities (lead_id, actor_id, kind, body) values (${leadId}, ${s.profile.id}, ${kind.data}, ${body})`;
      if (RESPONSE_KINDS.has(kind.data)) {
        await tx`update app.leads set first_response_at = coalesce(first_response_at, now()),
                 status = case when status in ('new', 'assigned') then 'contacted' else status end
                 where id = ${leadId}`;
      }
      if (kind.data === "proposal") {
        await tx`update app.leads set status = 'proposal_sent' where id = ${leadId} and status not in ('won', 'lost', 'archived')`;
      }
    });
  } catch (err) {
    return fail(err);
  }
  revalidatePath(`/admin/contactos/${leadId}`);
  return { ok: true, message: "Registado.", at: Date.now() };
}

export async function updateLeadAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  const leadId = String(fd.get("leadId"));
  const version = Number(fd.get("version"));
  const status = z.enum(LEAD_STATUSES).safeParse(fd.get("status"));
  const lostReason = String(fd.get("lostReason") ?? "").trim().slice(0, 300) || null;
  const nextAction = String(fd.get("nextAction") ?? "").trim().slice(0, 300) || null;
  const nextDate = String(fd.get("nextActionDate") ?? "");
  const nextTime = String(fd.get("nextActionTime") ?? "") || "09:00";
  if (!status.success) return { ok: false, message: "Estado inválido." };
  if (status.data === "lost" && !lostReason) return { ok: false, fields: { lostReason: "Indica o motivo da perda." } };
  const nextAt = /^\d{4}-\d{2}-\d{2}$/.test(nextDate) && /^\d{2}:\d{2}$/.test(nextTime) ? lisbonLocalToUtc(nextDate, nextTime) : null;
  try {
    await withStaff([...CRM], async (tx, s) => {
      const [cur] = (await tx`select status from app.leads where id = ${leadId}`) as unknown as { status: string }[];
      if (!cur) throw new Error("Contacto não encontrado.");
      const rows = await tx`update app.leads set status = ${status.data}, lost_reason = ${status.data === "lost" ? lostReason : null},
          next_action = ${nextAction}, next_action_at = ${nextAt}
        where id = ${leadId} and version = ${version} returning id`;
      if (rows.length === 0) throw new ConflictError();
      if (cur.status !== status.data) {
        await tx`insert into app.lead_activities (lead_id, actor_id, kind, body, meta)
                 values (${leadId}, ${s.profile.id}, 'status_change', ${lostReason}, ${tx.json({ from: cur.status, to: status.data })})`;
      }
    });
  } catch (err) {
    return fail(err);
  }
  revalidatePath(`/admin/contactos/${leadId}`);
  revalidatePath("/admin/contactos");
  return { ok: true, message: "Contacto atualizado.", at: Date.now() };
}

export async function assignLeadAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  const leadId = String(fd.get("leadId"));
  const assignee = String(fd.get("assignee") ?? "");
  try {
    await withStaff([...CRM], async (tx, s) => {
      // Vendedor só pode assumir para si; administrador pode atribuir a qualquer colaborador ativo
      const target = s.profile.role === "admin" ? assignee || null : s.profile.id;
      if (target) {
        const [p] = (await tx`select id from app.profiles where id = ${target} and is_active and role in ('admin', 'sales')`) as unknown as { id: string }[];
        if (!p) throw new Error("Colaborador inválido.");
      }
      const rows = await tx`update app.leads set assigned_to = ${target},
          status = case when status = 'new' and ${target}::uuid is not null then 'assigned' when ${target}::uuid is null and status = 'assigned' then 'new' else status end
        where id = ${leadId} returning id`;
      if (rows.length === 0) throw new AuthError("Sem acesso a este contacto.");
      await tx`insert into app.lead_activities (lead_id, actor_id, kind, body, meta)
               values (${leadId}, ${s.profile.id}, 'assignment', ${target ? "Atribuído" : "Devolvido à fila central"}, ${tx.json({ assigned_to: target })})`;
    });
  } catch (err) {
    return fail(err);
  }
  revalidatePath(`/admin/contactos/${leadId}`);
  revalidatePath("/admin/contactos");
  return { ok: true, message: "Responsável atualizado.", at: Date.now() };
}

export async function withdrawPermissionAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  const leadId = String(fd.get("leadId"));
  const purpose = z.enum(["whatsapp_contact", "marketing"]).safeParse(fd.get("purpose"));
  if (!purpose.success) return { ok: false, message: "Opção inválida." };
  try {
    await withStaff([...CRM], async (tx, s) => {
      const [l] = (await tx`select email, phone_e164 from app.leads where id = ${leadId}`) as unknown as { email: string | null; phoneE164: string | null }[];
      if (!l) throw new AuthError("Sem acesso.");
      const contact = purpose.data === "whatsapp_contact" ? l.phoneE164 : l.email ?? l.phoneE164;
      if (!contact) throw new Error("Contacto sem dados para este canal.");
      await tx`insert into app.contact_permissions (lead_id, contact_value, channel, purpose, status, text_version, source, recorded_by)
               values (${leadId}, ${contact}, ${purpose.data === "whatsapp_contact" ? "whatsapp" : l.email ? "email" : "phone"}, ${purpose.data}, 'withdrawn', ${CONSENT_TEXT_VERSION}, 'admin:pedido do cliente', ${s.profile.id})`;
      await tx`insert into app.lead_activities (lead_id, actor_id, kind, body) values (${leadId}, ${s.profile.id}, 'note', ${`Autorização retirada: ${purpose.data === "whatsapp_contact" ? "WhatsApp" : "marketing"}`})`;
    });
  } catch (err) {
    return fail(err);
  }
  revalidatePath(`/admin/contactos/${leadId}`);
  return { ok: true, message: "Retirada registada.", at: Date.now() };
}

const manualLead = z.object({
  name: z.string().trim().min(2, "Indica o nome.").max(120),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().toLowerCase().max(200).optional(),
  source: z.enum(["phone", "walk_in", "email", "whatsapp", "other"]),
  message: z.string().trim().max(4000).optional(),
  vehicleId: z.string().optional(),
});

export async function createManualLeadAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = manualLead.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, fields: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const phone = parsed.data.phone ? normalizePhone(parsed.data.phone) : null;
  if (parsed.data.phone && !phone) return { ok: false, fields: { phone: "Telefone inválido." } };
  const email = parsed.data.email || null;
  if (email && !z.email().safeParse(email).success) return { ok: false, fields: { email: "Email inválido." } };
  if (!phone && !email) return { ok: false, fields: { phone: "Indica telefone ou email." } };
  let id: string;
  try {
    id = await withStaff([...CRM], async (tx, s) => {
      const vehicleId = parsed.data.vehicleId && /^[0-9a-f-]{36}$/.test(parsed.data.vehicleId) ? parsed.data.vehicleId : null;
      const [v] = vehicleId ? ((await tx`select reference from app.vehicles where id = ${vehicleId}`) as unknown as { reference: string }[]) : [];
      const kind = parsed.data.source === "walk_in" ? "walk_in" : parsed.data.source === "phone" ? "phone" : parsed.data.source === "whatsapp" ? "whatsapp" : "other";
      const [row] = (await tx`insert into app.leads (kind, source, vehicle_id, vehicle_reference, name, email, phone_e164, message, status, assigned_to, first_response_at)
        values (${kind}, ${parsed.data.source}, ${v ? vehicleId : null}, ${v?.reference ?? null}, ${parsed.data.name}, ${email}, ${phone}, ${parsed.data.message ?? null},
                'contacted', ${s.profile.id}, now()) returning id`) as unknown as { id: string }[];
      await tx`insert into app.lead_activities (lead_id, actor_id, kind, body) values (${row!.id}, ${s.profile.id}, 'created', 'Contacto registado manualmente')`;
      return row!.id;
    });
  } catch (err) {
    return fail(err);
  }
  redirect(`/admin/contactos/${id}`);
}

// ---------------------------------------------------------------------------
// Marcações
// ---------------------------------------------------------------------------
export async function confirmAppointmentAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("appointmentId"));
  const date = String(fd.get("date") ?? "");
  const time = String(fd.get("time") ?? "");
  const duration = Number(fd.get("duration") ?? 60);
  const staffId = String(fd.get("staffId") ?? "") || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return { ok: false, message: "Indica data e hora." };
  if (!Number.isInteger(duration) || duration < 15 || duration > 240) return { ok: false, message: "Duração inválida." };
  const start = lisbonLocalToUtc(date, time);
  if (start.getTime() < Date.now() - 3600_000) return { ok: false, message: "A hora escolhida já passou." };
  const end = new Date(start.getTime() + duration * 60_000);
  let leadId = "";
  try {
    await withStaff([...CRM], async (tx, s) => {
      const [a] = (await tx`select a.id, a.lead_id, a.status, l.email from app.appointments a join app.leads l on l.id = a.lead_id where a.id = ${id} for update of a`) as unknown as { id: string; leadId: string; status: string; email: string | null }[];
      if (!a) throw new AuthError("Sem acesso a esta marcação.");
      if (a.status === "cancelled" || a.status === "completed") throw new Error("Esta marcação já está fechada.");
      leadId = a.leadId;
      await tx`update app.appointments set status = 'confirmed', confirmed_start = ${start}, confirmed_end = ${end},
               staff_id = ${staffId ?? s.profile.id}, confirmed_by = ${s.profile.id} where id = ${id}`;
      await tx`update app.leads set status = 'visit_scheduled', first_response_at = coalesce(first_response_at, now()) where id = ${a.leadId} and status not in ('won', 'lost', 'archived')`;
      await tx`insert into app.lead_activities (lead_id, actor_id, kind, body, meta) values (${a.leadId}, ${s.profile.id}, 'appointment', 'Marcação confirmada', ${tx.json({ start: start.toISOString() })})`;
      if (a.email) {
        await enqueue(tx, { kind: "appointment_confirmed_customer", channel: "email", payload: { appointmentId: id }, idempotencyKey: `appt:${id}:confirmed:${start.toISOString()}` });
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Esta marcação")) return { ok: false, message: err.message };
    return fail(err);
  }
  revalidatePath("/admin/visitas");
  revalidatePath(`/admin/contactos/${leadId}`);
  return { ok: true, message: "Marcação confirmada.", at: Date.now() };
}

export async function closeAppointmentAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("appointmentId"));
  const outcome = z.enum(["cancelled", "completed", "no_show"]).safeParse(fd.get("outcome"));
  const reason = String(fd.get("reason") ?? "").trim().slice(0, 300) || null;
  if (!outcome.success) return { ok: false, message: "Opção inválida." };
  let leadId = "";
  try {
    await withStaff([...CRM], async (tx, s) => {
      const [a] = (await tx`select a.lead_id, a.status, l.email from app.appointments a join app.leads l on l.id = a.lead_id where a.id = ${id}`) as unknown as { leadId: string; status: string; email: string | null }[];
      if (!a) throw new AuthError("Sem acesso.");
      leadId = a.leadId;
      await tx`update app.appointments set status = ${outcome.data}, cancel_reason = ${outcome.data === "cancelled" ? reason : null} where id = ${id}`;
      await tx`insert into app.lead_activities (lead_id, actor_id, kind, body) values (${a.leadId}, ${s.profile.id}, 'appointment',
        ${{ cancelled: "Marcação cancelada", completed: "Visita realizada", no_show: "Cliente não compareceu" }[outcome.data] + (reason ? `: ${reason}` : "")})`;
      if (outcome.data === "cancelled" && a.email && a.status === "confirmed") {
        await enqueue(tx, { kind: "appointment_cancelled_customer", channel: "email", payload: { appointmentId: id }, idempotencyKey: `appt:${id}:cancelled` });
      }
    });
  } catch (err) {
    return fail(err);
  }
  revalidatePath("/admin/visitas");
  revalidatePath(`/admin/contactos/${leadId}`);
  return { ok: true, message: "Marcação atualizada.", at: Date.now() };
}

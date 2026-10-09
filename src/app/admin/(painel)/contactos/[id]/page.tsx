/* eslint-disable @next/next/no-img-element -- URLs temporárias de ficheiros privados */
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { requireStaff, withStaff } from "@/server/auth";
import { PageHeader, LeadStatusTag, Notice } from "@/components/admin/ui";
import { ActionForm, FieldMsg } from "@/components/admin/ActionForm";
import { addActivityAction, assignLeadAction, updateLeadAction, withdrawPermissionAction, confirmAppointmentAction, closeAppointmentAction } from "../actions";
import { formatDate, formatDateTime, formatKm, formatShortDateTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { waMeUrl } from "@/lib/whatsapp-link";
import { signedPrivateUrl } from "@/server/storage";
import {
  APPOINTMENT_STATUS_LABEL,
  FUEL_LABEL,
  LEAD_KIND_LABEL,
  LEAD_SOURCE_LABEL,
  LEAD_STATUSES,
  LEAD_STATUS_LABEL,
  PERIOD_LABEL,
  type AppointmentStatus,
  type Fuel,
  type LeadKind,
  type LeadSource,
  type LeadStatus,
  type Period,
} from "@/lib/domain";
import { getCrmSettings } from "@/lib/settings";

const ACTIVITY_LABEL: Record<string, string> = {
  created: "Criado",
  note: "Nota",
  status_change: "Estado",
  assignment: "Atribuição",
  call: "Chamada",
  email: "Email",
  whatsapp: "WhatsApp",
  proposal: "Proposta",
  appointment: "Marcação",
  system: "Sistema",
};

export default async function LeadDetail(props: PageProps<"/admin/contactos/[id]">) {
  const s = await requireStaff(["admin", "sales"]);
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const crm = await getCrmSettings();
  const data = await withStaff(undefined, async (tx) => {
    const [lead] = (await tx`select l.*, p.full_name as assignee, v.slug as vehicle_slug, v.make as vehicle_make, v.model as vehicle_model, v.status as vehicle_status
      from app.leads l left join app.profiles p on p.id = l.assigned_to left join app.vehicles v on v.id = l.vehicle_id where l.id = ${id}`) as unknown as {
      id: string; kind: LeadKind; source: LeadSource; name: string; email: string | null; phoneE164: string | null; preferredChannel: string | null; message: string | null;
      status: LeadStatus; assignedTo: string | null; assignee: string | null; nextAction: string | null; nextActionAt: Date | null; lostReason: string | null;
      firstResponseAt: Date | null; createdAt: Date; version: number; vehicleId: string | null; vehicleReference: string | null; vehicleSlug: string | null;
      vehicleMake: string | null; vehicleModel: string | null; vehicleStatus: string | null; pageUrl: string | null; isDemo: boolean;
    }[];
    if (!lead) return null;
    const activities = (await tx`select a.kind, a.body, a.meta, a.created_at, p.full_name from app.lead_activities a left join app.profiles p on p.id = a.actor_id
      where a.lead_id = ${id} order by a.created_at desc`) as unknown as { kind: string; body: string | null; meta: Record<string, unknown>; createdAt: Date; fullName: string | null }[];
    const appointments = (await tx`select a.id, a.kind, a.requested_date::text as requested_date, a.requested_period, a.status, a.confirmed_start, a.cancel_reason, b.name as branch
      from app.appointments a left join app.branches b on b.id = a.branch_id where a.lead_id = ${id} order by a.created_at desc`) as unknown as {
      id: string; kind: string; requestedDate: string; requestedPeriod: Period; status: AppointmentStatus; confirmedStart: Date | null; cancelReason: string | null; branch: string | null;
    }[];
    const [tradeIn] = (await tx`select id, make, model, year, mileage_km, fuel, condition_text from app.trade_in_requests where lead_id = ${id}`) as unknown as {
      id: string; make: string; model: string; year: number | null; mileageKm: number | null; fuel: Fuel | null; conditionText: string | null;
    }[];
    const tradeMedia = tradeIn ? ((await tx`select storage_path from app.trade_in_media where trade_in_id = ${tradeIn.id} order by created_at`) as unknown as { storagePath: string }[]) : [];
    const permissions = (await tx`select channel, purpose, status, text_version, source, created_at from app.contact_permissions where lead_id = ${id} order by created_at desc`) as unknown as {
      channel: string; purpose: string; status: string; textVersion: string; source: string; createdAt: Date;
    }[];
    const staff = (await tx`select id, full_name from app.profiles where is_active and role in ('admin', 'sales') order by full_name`) as unknown as { id: string; fullName: string }[];
    const [conv] = lead.phoneE164 ? ((await tx`select id from app.conversations where contact_phone_e164 = ${lead.phoneE164} or lead_id = ${id} limit 1`) as unknown as { id: string }[]) : [];
    return { lead, activities, appointments, tradeIn, tradeMedia, permissions, staff, conv };
  });
  if (!data) notFound();
  const { lead } = data;
  const photos = await Promise.all(data.tradeMedia.map((m) => signedPrivateUrl(m.storagePath).catch(() => null)));
  const whatsappAllowed = data.permissions.find((p) => p.purpose === "whatsapp_contact")?.status === "granted";
  const canTake = s.profile.role === "sales" && !lead.assignedTo;

  return (
    <>
      <PageHeader title={lead.name} description={`${LEAD_KIND_LABEL[lead.kind]} · ${LEAD_SOURCE_LABEL[lead.source]} · recebido ${formatDateTime(lead.createdAt)}`} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <LeadStatusTag status={lead.status} />
        {lead.isDemo && <span className="tag tag-dark">Demonstração</span>}
        {!lead.firstResponseAt && <span className="tag tag-danger">Sem resposta registada</span>}
      </div>
      {canTake && (
        <div className="mb-4">
          <Notice tone="warn">
            Este contacto está na fila central.
            <ActionForm action={assignLeadAction} submitLabel="Assumir este contacto" submitClassName="btn-dark btn-sm mt-2">
              <input type="hidden" name="leadId" value={lead.id} />
            </ActionForm>
          </Notice>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <section className="panel p-4">
            <h2 className="heading text-base">Pedido</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {lead.phoneE164 && (
                <a href={`tel:${lead.phoneE164}`} className="btn btn-outline btn-sm">
                  <Phone className="h-4 w-4" /> {formatPhone(lead.phoneE164)}
                </a>
              )}
              {lead.email && (
                <a href={`mailto:${lead.email}`} className="btn btn-outline btn-sm">
                  <Mail className="h-4 w-4" /> {lead.email}
                </a>
              )}
              {lead.phoneE164 && (
                <a href={waMeUrl(lead.phoneE164, `Olá ${lead.name.split(" ")[0]}, daqui fala a Inova Auto${lead.vehicleReference ? ` sobre a viatura ${lead.vehicleReference}` : ""}.`)} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp btn-sm">
                  <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
                </a>
              )}
              {data.conv && (
                <Link href={`/admin/whatsapp/${data.conv.id}`} className="btn btn-outline btn-sm">
                  Conversa na caixa de entrada
                </Link>
              )}
            </div>
            {lead.phoneE164 && !whatsappAllowed && <p className="mt-2 text-xs text-muted">Sem autorização registada para WhatsApp: usa outro canal, salvo se o cliente iniciar a conversa.</p>}
            {lead.preferredChannel && <p className="mt-2 text-sm">Prefere: <strong>{{ phone: "telefone", email: "email", whatsapp: "WhatsApp" }[lead.preferredChannel]}</strong></p>}
            {lead.vehicleReference && (
              <p className="mt-2 text-sm">
                Viatura: {lead.vehicleId ? <Link className="font-semibold underline" href={`/admin/viaturas/${lead.vehicleId}`}>{lead.vehicleReference} · {lead.vehicleMake} {lead.vehicleModel}</Link> : lead.vehicleReference}
                {lead.vehicleStatus && lead.vehicleStatus !== "available" && <span className="tag tag-warn ml-2">{lead.vehicleStatus === "sold" ? "Vendida" : lead.vehicleStatus === "reserved" ? "Reservada" : lead.vehicleStatus}</span>}
              </p>
            )}
            {lead.message && <p className="mt-3 whitespace-pre-line rounded-[var(--radius-sm)] bg-paper p-3 text-sm">{lead.message}</p>}
          </section>

          {data.tradeIn && (
            <section className="panel p-4">
              <h2 className="heading text-base">Retoma proposta</h2>
              <p className="mt-2 text-sm">
                <strong>
                  {data.tradeIn.make} {data.tradeIn.model}
                </strong>{" "}
                · {data.tradeIn.year} · {formatKm(data.tradeIn.mileageKm)} · {data.tradeIn.fuel ? FUEL_LABEL[data.tradeIn.fuel] : "—"}
              </p>
              {data.tradeIn.conditionText && <p className="mt-2 whitespace-pre-line text-sm text-ink-soft">{data.tradeIn.conditionText}</p>}
              {photos.length > 0 && (
                <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {photos.map((u, i) =>
                    u ? (
                      <li key={i}>
                        <a href={u} target="_blank" rel="noopener noreferrer">
                          <img src={u} alt={`Fotografia ${i + 1} da retoma`} className="aspect-square w-full rounded object-cover" />
                        </a>
                      </li>
                    ) : null,
                  )}
                </ul>
              )}
              <p className="mt-2 text-xs text-muted">Ligações das fotografias válidas durante 5 minutos.</p>
            </section>
          )}

          {data.appointments.length > 0 && (
            <section className="panel p-4">
              <h2 className="heading text-base">Marcações</h2>
              <ul className="mt-3 space-y-4">
                {data.appointments.map((a) => (
                  <li key={a.id} className="rounded-[var(--radius-sm)] border border-line p-3">
                    <p className="text-sm">
                      <strong>{a.kind === "test_drive" ? "Test drive" : "Visita"}</strong> · pedido para {formatDate(a.requestedDate)} ({PERIOD_LABEL[a.requestedPeriod]}){a.branch ? ` · ${a.branch}` : ""}
                    </p>
                    <p className="mt-1 text-sm">
                      Estado: <strong>{APPOINTMENT_STATUS_LABEL[a.status]}</strong>
                      {a.confirmedStart && <> · {formatDateTime(a.confirmedStart)}</>}
                      {a.cancelReason && <> · {a.cancelReason}</>}
                    </p>
                    {(a.status === "requested" || a.status === "confirmed") && (
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <ActionForm action={confirmAppointmentAction} submitLabel={a.status === "confirmed" ? "Reagendar" : "Confirmar"} submitClassName="btn-sm">
                          <input type="hidden" name="appointmentId" value={a.id} />
                          <div className="grid grid-cols-3 gap-2">
                            <input name="date" type="date" defaultValue={a.requestedDate} className="input" aria-label="Data" required />
                            <input name="time" type="time" defaultValue={a.requestedPeriod === "morning" ? "10:00" : "15:00"} className="input" aria-label="Hora" required />
                            <select name="duration" defaultValue={crm.appointmentSlotMinutes} className="input" aria-label="Duração">
                              {[30, 45, 60, 90, 120].map((m) => (
                                <option key={m} value={m}>
                                  {m} min
                                </option>
                              ))}
                            </select>
                          </div>
                          <select name="staffId" defaultValue={lead.assignedTo ?? s.profile.id} className="input" aria-label="Vendedor">
                            {data.staff.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.fullName}
                              </option>
                            ))}
                          </select>
                        </ActionForm>
                        <div className="space-y-2">
                          <ActionForm action={closeAppointmentAction} submitLabel="Cancelar marcação" submitClassName="btn-outline btn-sm">
                            <input type="hidden" name="appointmentId" value={a.id} />
                            <input type="hidden" name="outcome" value="cancelled" />
                            <input name="reason" className="input" placeholder="Motivo (opcional)" aria-label="Motivo" />
                          </ActionForm>
                          {a.status === "confirmed" && (
                            <div className="flex gap-2">
                              <ActionForm action={closeAppointmentAction} submitLabel="Realizada" submitClassName="btn-outline btn-sm">
                                <input type="hidden" name="appointmentId" value={a.id} />
                                <input type="hidden" name="outcome" value="completed" />
                              </ActionForm>
                              <ActionForm action={closeAppointmentAction} submitLabel="Não compareceu" submitClassName="btn-outline btn-sm">
                                <input type="hidden" name="appointmentId" value={a.id} />
                                <input type="hidden" name="outcome" value="no_show" />
                              </ActionForm>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="panel p-4">
            <h2 className="heading text-base">Histórico</h2>
            <ActionForm action={addActivityAction} submitLabel="Registar" submitClassName="btn-sm" resetOnSuccess className="mt-3">
              <>
                <>
                  <input type="hidden" name="leadId" value={lead.id} />
                  <div className="flex flex-wrap gap-2">
                    {[
                      ["note", "Nota interna"],
                      ["call", "Chamada feita"],
                      ["email", "Email enviado"],
                      ["whatsapp", "WhatsApp enviado"],
                      ["proposal", "Proposta enviada"],
                    ].map(([v, l], i) => (
                      <label key={v} className="inline-flex min-h-9 items-center gap-2 rounded-[var(--radius-sm)] border border-line-strong px-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
                        <input type="radio" name="kind" value={v} defaultChecked={i === 0} className="sr-only" /> {l}
                      </label>
                    ))}
                  </div>
                  <textarea name="body" className="input min-h-20" placeholder="O que aconteceu?" aria-label="Descrição" />
                  <FieldMsg name="body" />
                </>
              </>
            </ActionForm>
            <ol className="mt-5 space-y-3 border-l-2 border-line pl-4">
              {data.activities.map((a, i) => (
                <li key={i} className="text-sm">
                  <p className="text-xs text-muted">
                    <span className="font-semibold text-ink">{ACTIVITY_LABEL[a.kind] ?? a.kind}</span> · {formatShortDateTime(a.createdAt)} · {a.fullName ?? "Sistema"}
                  </p>
                  {a.kind === "status_change" && <p>{LEAD_STATUS_LABEL[a.meta.from as LeadStatus]} → {LEAD_STATUS_LABEL[a.meta.to as LeadStatus]}</p>}
                  {a.body && <p className="whitespace-pre-line">{a.body}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="panel p-4">
            <h2 className="heading text-base">Estado e próxima ação</h2>
            <ActionForm action={updateLeadAction} submitLabel="Guardar" submitClassName="btn-sm" className="mt-3">
              <>
                <>
                  <input type="hidden" name="leadId" value={lead.id} />
                  <input type="hidden" name="version" value={lead.version} />
                  <select name="status" defaultValue={lead.status} className="input" aria-label="Estado">
                    {LEAD_STATUSES.map((x) => (
                      <option key={x} value={x}>
                        {LEAD_STATUS_LABEL[x]}
                      </option>
                    ))}
                  </select>
                  <input name="lostReason" defaultValue={lead.lostReason ?? ""} className="input" placeholder="Motivo da perda (se Perdido)" aria-label="Motivo da perda" />
                  <FieldMsg name="lostReason" />
                  <input name="nextAction" defaultValue={lead.nextAction ?? ""} className="input" placeholder="Próxima ação (ex.: ligar a confirmar)" aria-label="Próxima ação" />
                  <div className="grid grid-cols-2 gap-2">
                    <input name="nextActionDate" type="date" defaultValue={lead.nextActionAt ? new Date(lead.nextActionAt).toISOString().slice(0, 10) : ""} className="input" aria-label="Data" />
                    <input name="nextActionTime" type="time" defaultValue="09:00" className="input" aria-label="Hora" />
                  </div>
                </>
              </>
            </ActionForm>
          </section>

          <section className="panel p-4">
            <h2 className="heading text-base">Responsável</h2>
            <p className="mt-1 text-sm">{lead.assignee ?? "Fila central"}</p>
            {s.profile.role === "admin" && (
              <ActionForm action={assignLeadAction} submitLabel="Atribuir" submitClassName="btn-sm" className="mt-3">
                <input type="hidden" name="leadId" value={lead.id} />
                <select name="assignee" defaultValue={lead.assignedTo ?? ""} className="input" aria-label="Responsável">
                  <option value="">Fila central</option>
                  {data.staff.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName}
                    </option>
                  ))}
                </select>
              </ActionForm>
            )}
          </section>

          <section className="panel p-4">
            <h2 className="heading text-base">Autorizações de contacto</h2>
            <ul className="mt-2 space-y-2 text-xs">
              {data.permissions.map((p, i) => (
                <li key={i}>
                  <span className={`tag ${p.status === "granted" ? "tag-ok" : "tag-danger"}`}>{p.status === "granted" ? "Dada" : "Retirada"}</span>{" "}
                  {{ request_response: "Resposta ao pedido", whatsapp_contact: "WhatsApp", marketing: "Marketing", search_alerts: "Alertas" }[p.purpose] ?? p.purpose} · {p.channel}
                  <span className="block text-muted">
                    {formatShortDateTime(p.createdAt)} · texto {p.textVersion} · {p.source}
                  </span>
                </li>
              ))}
            </ul>
            <ActionForm action={withdrawPermissionAction} submitLabel="Registar retirada" submitClassName="btn-outline btn-sm" className="mt-3">
              <input type="hidden" name="leadId" value={lead.id} />
              <select name="purpose" className="input" aria-label="Autorização a retirar">
                <option value="whatsapp_contact">WhatsApp</option>
                <option value="marketing">Marketing</option>
              </select>
            </ActionForm>
          </section>
        </aside>
      </div>
    </>
  );
}

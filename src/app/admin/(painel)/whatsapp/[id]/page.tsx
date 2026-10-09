import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff, withStaff } from "@/server/auth";
import { PageHeader, Notice } from "@/components/admin/ui";
import { formatShortDateTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { insideServiceWindow, SERVICE_WINDOW_HOURS } from "@/server/whatsapp";
import { Composer } from "./Composer";
import { env } from "@/lib/env";

const STATUS: Record<string, string> = {
  received: "",
  pending: "A enviar",
  accepted: "Aceite pela Meta",
  sent: "Enviada",
  delivered: "Entregue",
  read: "Lida",
  failed: "Falhou",
  uncertain: "Resultado incerto",
};

export default async function Conversation(props: PageProps<"/admin/whatsapp/[id]">) {
  await requireStaff(["admin", "sales"]);
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await withStaff(undefined, async (tx) => {
    const [c] = (await tx`select c.*, p.full_name as assignee from app.conversations c left join app.profiles p on p.id = c.assigned_to where c.id = ${id}`) as unknown as {
      id: string; contactName: string | null; contactPhoneE164: string | null; lastInboundAt: Date | null; optedOutAt: Date | null; leadId: string | null; assignee: string | null;
    }[];
    if (!c) return null;
    const messages = (await tx`select m.id, m.direction, m.body, m.template_name, m.status, m.error_message, m.created_at, p.full_name as sender
      from app.messages m left join app.profiles p on p.id = m.sent_by where m.conversation_id = ${id} order by m.created_at`) as unknown as {
      id: string; direction: "inbound" | "outbound"; body: string | null; templateName: string | null; status: string; errorMessage: string | null; createdAt: Date; sender: string | null;
    }[];
    const [t] = (await tx`select value from app.site_settings where key = 'whatsapp_templates'`) as unknown as { value: { key: string; label: string; status: string }[] }[];
    return { c, messages, templates: (t?.value ?? []).filter((x) => x.status === "APPROVED") };
  });
  if (!data) notFound();
  const { c } = data;
  const open = insideServiceWindow(c.lastInboundAt);
  return (
    <>
      <PageHeader
        title={c.contactName ?? formatPhone(c.contactPhoneE164)}
        description={`${formatPhone(c.contactPhoneE164)} · ${c.assignee ?? "Fila central"}`}
        actions={c.leadId && <Link href={`/admin/contactos/${c.leadId}`} className="btn btn-outline">Ver contacto no CRM</Link>}
      />
      {c.optedOutAt && <div className="mb-4"><Notice tone="danger">O cliente pediu para não ser contactado por WhatsApp. Não é possível enviar mensagens.</Notice></div>}
      <div className="panel flex max-h-[60dvh] flex-col gap-2 overflow-y-auto p-4">
        {data.messages.map((m) => (
          <div key={m.id} className={`max-w-[80%] rounded-[var(--radius-md)] px-3 py-2 text-sm ${m.direction === "inbound" ? "self-start bg-paper" : "self-end bg-brand-soft"}`}>
            {m.templateName && <p className="text-xs font-semibold text-muted">Template: {m.templateName}</p>}
            <p className="whitespace-pre-line">{m.body}</p>
            <p className="mt-1 text-[0.7rem] text-muted">
              {formatShortDateTime(m.createdAt)}
              {m.direction === "outbound" && <> · {m.sender ?? "Sistema"} · {STATUS[m.status] ?? m.status}</>}
              {m.errorMessage && <span className="block text-danger">{m.errorMessage}</span>}
            </p>
          </div>
        ))}
        {data.messages.length === 0 && <p className="text-sm text-muted">Sem mensagens.</p>}
      </div>
      <p className="mt-2 text-xs text-muted">
        {open
          ? `Janela de atendimento aberta (até ${SERVICE_WINDOW_HOURS} h após a última mensagem do cliente): podes responder com texto livre.`
          : "Fora da janela de atendimento: só podes enviar templates aprovados pela Meta."}{" "}
        «Entregue» e «Lida» só aparecem se a Meta enviar esses estados.
      </p>
      {!c.optedOutAt && env().WHATSAPP_PROVIDER !== "disabled" && <Composer conversationId={c.id} windowOpen={open} templates={data.templates.map((t) => ({ key: t.key, label: t.label }))} />}
    </>
  );
}

import Link from "next/link";
import { requireStaff, withStaff } from "@/server/auth";
import { PageHeader, Empty, Notice } from "@/components/admin/ui";
import { formatShortDateTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { env } from "@/lib/env";
import { insideServiceWindow } from "@/server/whatsapp";

export default async function Inbox() {
  await requireStaff(["admin", "sales"]);
  const provider = env().WHATSAPP_PROVIDER;
  const rows = await withStaff(undefined, async (tx) =>
    (await tx`select c.id, c.contact_name, c.contact_phone_e164, c.last_inbound_at, c.last_message_at, c.opted_out_at, p.full_name as assignee,
        (select body from app.messages m where m.conversation_id = c.id order by m.created_at desc limit 1) as last_body
      from app.conversations c left join app.profiles p on p.id = c.assigned_to
      order by c.last_message_at desc nulls last limit 200`) as unknown as {
      id: string; contactName: string | null; contactPhoneE164: string | null; lastInboundAt: Date | null; lastMessageAt: Date | null; optedOutAt: Date | null; assignee: string | null; lastBody: string | null;
    }[],
  );
  return (
    <>
      <PageHeader title="WhatsApp" description="Caixa de entrada do número central (WhatsApp Business Platform – Cloud API). As respostas saem sempre do número da empresa." />
      {provider === "disabled" && (
        <div className="mb-4">
          <Notice tone="warn">
            <strong>Implementada e por ativar.</strong> Falta configurar a conta Meta, o número e as credenciais (ver docs/WHATSAPP.md). Até lá, os botões «Falar no WhatsApp» do site abrem o WhatsApp do cliente (Click to Chat).
          </Notice>
        </div>
      )}
      {provider === "mock" && (
        <div className="mb-4">
          <Notice tone="warn">Modo de teste (mock): nenhuma mensagem real é enviada.</Notice>
        </div>
      )}
      {rows.length === 0 ? (
        <Empty>Ainda não há conversas. Aparecem aqui quando um cliente escreve para o número da empresa.</Empty>
      ) : (
        <ul className="panel divide-y divide-line">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/whatsapp/${c.id}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-paper">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{c.contactName ?? formatPhone(c.contactPhoneE164)}</span>
                  <span className="block truncate text-sm text-muted">{c.lastBody}</span>
                </span>
                {c.optedOutAt ? <span className="tag tag-danger">Pediu para parar</span> : insideServiceWindow(c.lastInboundAt) ? <span className="tag tag-ok">Janela aberta</span> : <span className="tag">Só templates</span>}
                <span className="text-xs text-muted">{c.assignee ?? "Fila central"}</span>
                <span className="num text-xs text-muted">{formatShortDateTime(c.lastMessageAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

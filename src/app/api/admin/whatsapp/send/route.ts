import { after } from "next/server";
import { z } from "zod";
import { apiError, apiOk, readJson } from "@/server/http";
import { sameOrigin } from "@/server/abuse";
import { AuthError, withStaff } from "@/server/auth";
import { enqueue } from "@/server/outbox";
import { insideServiceWindow } from "@/server/whatsapp";
import { processOutbox } from "@/server/outbox-worker";
import { env } from "@/lib/env";
import { asSystem } from "@/lib/db";

const input = z.object({
  conversationId: z.string().uuid(),
  text: z.string().trim().min(1).max(4096).optional(),
  templateKey: z.string().max(60).optional(),
  idempotencyKey: z.string().uuid(),
});

/**
 * POST /api/admin/whatsapp/send — envio a partir da caixa de entrada (colaboradores autenticados).
 * O destinatário é SEMPRE o da conversa (o pedido não escolhe números, templates livres nem URLs).
 * Texto livre só dentro da janela de atendimento; fora dela, só templates aprovados configurados.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return apiError("forbidden", "Origem não autorizada.");
  if (env().WHATSAPP_PROVIDER === "disabled") return apiError("unavailable", "A integração WhatsApp Cloud API está implementada mas por ativar.");
  let body: unknown;
  try {
    body = await readJson(req, 16_000);
  } catch {
    return apiError("rejected", "Pedido inválido.");
  }
  const parsed = input.safeParse(body);
  if (!parsed.success || (!parsed.data.text && !parsed.data.templateKey)) return apiError("validation_error", "Escreve a mensagem ou escolhe um template.");
  try {
    const messageId = await withStaff(["admin", "sales"], async (tx, s) => {
      const [c] = (await tx`select id, last_inbound_at, opted_out_at, assigned_to, contact_name from app.conversations where id = ${parsed.data.conversationId}`) as unknown as {
        id: string; lastInboundAt: Date | null; optedOutAt: Date | null; assignedTo: string | null; contactName: string | null;
      }[];
      if (!c) throw new AuthError("Sem acesso a esta conversa.");
      if (c.optedOutAt) throw new Error("O cliente pediu para não ser contactado por WhatsApp.");
      let templateName: string | null = null;
      let templateLanguage: string | null = null;
      let bodyParams: string[] = [];
      if (parsed.data.templateKey) {
        const [t] = (await tx`select value from app.site_settings where key = 'whatsapp_templates'`) as unknown as { value: { key: string; name: string; language: string; status: string; params?: string[] }[] }[];
        const tpl = (t?.value ?? []).find((x) => x.key === parsed.data.templateKey);
        if (!tpl || tpl.status !== "APPROVED") throw new Error("Template não aprovado ou inexistente.");
        templateName = tpl.name;
        templateLanguage = tpl.language;
        // Parâmetros definidos no painel; {nome} é substituído pelo nome do contacto
        bodyParams = (tpl.params ?? []).map((p) => p.replace("{nome}", c.contactName?.split(" ")[0] ?? ""));
      } else if (!insideServiceWindow(c.lastInboundAt)) {
        throw new Error("Passaram mais de 24 horas desde a última mensagem do cliente. Usa um template aprovado.");
      }
      if (!c.assignedTo && s.profile.role === "sales") await tx`update app.conversations set assigned_to = ${s.profile.id} where id = ${c.id}`;
      // Escrita da mensagem como rotina de confiança (staff não insere mensagens diretamente)
      return asSystem(async (sys) => {
        const [m] = (await sys`insert into app.messages (conversation_id, direction, message_type, body, template_name, template_language, status, sent_by, idempotency_key)
          values (${c.id}, 'outbound', ${templateName ? "template" : "text"}, ${parsed.data.text ?? null}, ${templateName}, ${templateLanguage}, 'pending', ${s.profile.id}, ${parsed.data.idempotencyKey})
          on conflict (idempotency_key) do update set idempotency_key = excluded.idempotency_key returning id`) as unknown as { id: string }[];
        await enqueue(sys, { kind: "whatsapp_message", channel: "whatsapp", payload: { messageId: m!.id, bodyParams }, idempotencyKey: `wa:${m!.id}` });
        await sys`update app.conversations set last_message_at = now() where id = ${c.id}`;
        return m!.id;
      });
    });
    after(() => processOutbox(5).catch((e) => console.error("outbox", e)));
    return apiOk({ messageId, status: "pending" }, 202);
  } catch (err) {
    if (err instanceof AuthError) return apiError("forbidden", err.message);
    return apiError("rejected", (err as Error).message);
  }
}

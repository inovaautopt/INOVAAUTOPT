import "server-only";
import type { Tx } from "@/lib/db";

export type OutboxKind =
  | "lead_received_customer"
  | "lead_received_staff"
  | "appointment_requested_customer"
  | "appointment_confirmed_customer"
  | "appointment_cancelled_customer"
  | "lead_unanswered_staff"
  | "saved_search_verify"
  | "search_alert"
  | "whatsapp_message";

export interface OutboxItem {
  kind: OutboxKind;
  channel: "email" | "whatsapp";
  payload: Record<string, unknown>;
  idempotencyKey: string;
  delaySeconds?: number;
}

/**
 * Regista uma notificação na outbox dentro da MESMA transação que grava o pedido.
 * Se o envio falhar mais tarde, o pedido continua guardado e visível no painel.
 * A chave de idempotência impede notificações duplicadas.
 */
export async function enqueue(tx: Tx, item: OutboxItem): Promise<void> {
  await tx`
    insert into app.notification_outbox (kind, channel, payload, idempotency_key, next_attempt_at)
    values (${item.kind}, ${item.channel}, ${tx.json(item.payload as never)}, ${item.idempotencyKey},
            now() + make_interval(secs => ${item.delaySeconds ?? 0}))
    on conflict (idempotency_key) do nothing
  `;
}

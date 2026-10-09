import "server-only";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import { asSystem } from "@/lib/db";
import { enqueue } from "./outbox";
import { CONSENT_TEXT_VERSION } from "@/lib/validation";

const ALLOWED_KEYS = new Set(["q", "marca", "modelo", "precoMin", "precoMax", "anoMin", "anoMax", "kmMin", "kmMax", "potenciaMin", "potenciaMax", "combustivel", "caixa", "carrocaria", "tracao", "lugares", "portas", "cor", "instalacao"]);

export function token() {
  return randomBytes(32).toString("base64url");
}
/** Token de cancelamento derivado do id (HMAC): pode ser incluído em todos os emails de alerta. */
export function unsubscribeToken(id: string) {
  const secret = env().RATE_LIMIT_SALT ?? env().CRON_SECRET ?? "dev-only-secret";
  return createHmac("sha256", secret).update(`unsub:${id}`).digest("base64url");
}
export function hashToken(t: string) {
  return createHash("sha256").update(t).digest("hex");
}

export function cleanCriteria(c: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(c)
      .filter(([k, v]) => ALLOWED_KEYS.has(k) && typeof v === "string" && v.length <= 80)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

/**
 * Cria um alerta pendente e envia email de confirmação (double opt-in). Se já existir,
 * não revela se o email está registado: responde sempre da mesma forma.
 */
export async function createSavedSearch(email: string, criteria: Record<string, string>) {
  const clean = cleanCriteria(criteria);
  const criteriaHash = createHash("sha256").update(JSON.stringify(clean)).digest("hex");
  const verify = token();
  const newId = randomUUID();
  const unsubscribe = unsubscribeToken(newId);
  return asSystem(async (tx) => {
    const [row] = (await tx`
      insert into app.saved_searches (id, email, criteria, criteria_hash, verify_token_hash, unsubscribe_token_hash)
      values (${newId}, ${email}, ${tx.json(clean)}, ${criteriaHash}, ${hashToken(verify)}, ${hashToken(unsubscribe)})
      on conflict (email, criteria_hash) do update set
        verify_token_hash = case when app.saved_searches.status = 'active' then app.saved_searches.verify_token_hash else excluded.verify_token_hash end,
        status = case when app.saved_searches.status = 'cancelled' then 'pending' else app.saved_searches.status end
      returning id, status, (xmax = 0) as inserted, verify_token_hash = ${hashToken(verify)} as fresh_token`) as unknown as { id: string; status: string; inserted: boolean; freshToken: boolean }[];
    if (row && row.status === "pending" && row.freshToken) {
      await enqueue(tx, {
        kind: "saved_search_verify",
        channel: "email",
        // Tokens em claro só existem na outbox até ao envio; são apagados do payload depois de enviados.
        payload: { savedSearchId: row.id, verifyToken: verify },
        idempotencyKey: `saved_search:${row.id}:verify:${hashToken(verify).slice(0, 16)}`,
      });
      await tx`insert into app.contact_permissions (contact_value, channel, purpose, status, text_version, source)
               values (${email}, 'email', 'search_alerts', 'granted', ${CONSENT_TEXT_VERSION}, 'website:alerta (por confirmar)')`;
    }
  });
}

export async function confirmSavedSearch(t: string): Promise<boolean> {
  return asSystem(async (tx) => {
    const rows = await tx`update app.saved_searches set status = 'active', verified_at = now()
      where verify_token_hash = ${hashToken(t)} and status in ('pending', 'active') returning id`;
    return rows.length > 0;
  });
}

export async function cancelSavedSearch(t: string): Promise<boolean> {
  return asSystem(async (tx) => {
    const rows = (await tx`update app.saved_searches set status = 'cancelled', cancelled_at = now()
      where unsubscribe_token_hash = ${hashToken(t)} and status <> 'cancelled' returning email`) as unknown as { email: string }[];
    if (rows[0]) {
      await tx`insert into app.contact_permissions (contact_value, channel, purpose, status, text_version, source)
               values (${rows[0].email}, 'email', 'search_alerts', 'withdrawn', ${CONSENT_TEXT_VERSION}, 'email:cancelar')`;
    }
    return rows.length > 0;
  });
}

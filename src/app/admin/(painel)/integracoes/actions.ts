"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withStaff, AuthError } from "@/server/auth";
import { asSystem } from "@/lib/db";
import { env } from "@/lib/env";
import { processIntegrationEvents, processOutbox } from "@/server/outbox-worker";
import type { ActionState } from "@/components/admin/ActionForm";

export async function retryOutboxAction(fd: FormData) {
  const id = String(fd.get("id"));
  await withStaff(["admin"], async () => {});
  await asSystem((tx) => tx`update app.notification_outbox set status = 'pending', next_attempt_at = now(), max_attempts = greatest(max_attempts, attempts + 3) where id = ${id} and status in ('failed', 'dead')`);
  await processOutbox(5);
  revalidatePath("/admin/integracoes");
}

export async function runNowAction() {
  await withStaff(["admin"], async () => {});
  await processIntegrationEvents(50);
  await processOutbox(20);
  revalidatePath("/admin/integracoes");
}

const tpl = z.array(
  z.object({
    key: z.string().regex(/^[a-z0-9_]+$/),
    label: z.string().min(1).max(80),
    name: z.string().regex(/^[a-z0-9_]+$/),
    language: z.string().regex(/^[a-z]{2}(_[A-Z]{2})?$/),
    status: z.string(),
    category: z.string().optional(),
    params: z.array(z.string()).max(10).optional(),
  }),
);

export async function saveTemplatesAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  let parsed;
  try {
    parsed = tpl.safeParse(JSON.parse(String(fd.get("templates") ?? "[]")));
  } catch {
    return { ok: false, message: "JSON inválido." };
  }
  if (!parsed.success) return { ok: false, message: `Formato inválido: ${parsed.error.issues[0]?.message}` };
  try {
    await withStaff(["admin"], (tx, s) => tx`insert into app.site_settings (key, value, is_public, updated_by) values ('whatsapp_templates', ${tx.json(parsed.data)}, false, ${s.profile.id})
      on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`);
  } catch (err) {
    return { ok: false, message: err instanceof AuthError ? err.message : "Não foi possível guardar." };
  }
  revalidatePath("/admin/integracoes");
  return { ok: true, message: "Templates guardados. Só os que têm estado APPROVED podem ser usados.", at: Date.now() };
}

/** Lê da Meta o nome, idioma, categoria e estado REAIS dos templates (não assume aprovação). */
export async function syncTemplatesAction(_prev: ActionState): Promise<ActionState> {
  const e = env();
  if (e.WHATSAPP_PROVIDER !== "cloud_api" || !e.WHATSAPP_WABA_ID) return { ok: false, message: "Configura WHATSAPP_PROVIDER=cloud_api e WHATSAPP_WABA_ID primeiro." };
  try {
    await withStaff(["admin"], async () => {});
    const res = await fetch(`https://graph.facebook.com/${e.WHATSAPP_GRAPH_API_VERSION}/${e.WHATSAPP_WABA_ID}/message_templates?fields=name,language,status,category&limit=200`, {
      headers: { Authorization: `Bearer ${e.WHATSAPP_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json()) as { data?: { name: string; language: string; status: string; category?: string }[]; error?: { message?: string } };
    if (!res.ok || !json.data) return { ok: false, message: `Meta: ${json.error?.message ?? res.status}` };
    await withStaff(["admin"], async (tx, s) => {
      const [cur] = (await tx`select value from app.site_settings where key = 'whatsapp_templates'`) as unknown as { value: { key: string; label: string; name: string; language: string; params?: string[] }[] }[];
      const local = cur?.value ?? [];
      const merged = json.data!.map((t) => {
        const prevT = local.find((l) => l.name === t.name && l.language === t.language);
        return { key: prevT?.key ?? `${t.name}_${t.language}`.toLowerCase(), label: prevT?.label ?? t.name, name: t.name, language: t.language, status: t.status, category: t.category, params: prevT?.params ?? [] };
      });
      await tx`insert into app.site_settings (key, value, is_public, updated_by) values ('whatsapp_templates', ${tx.json(merged)}, false, ${s.profile.id})
        on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`;
    });
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
  revalidatePath("/admin/integracoes");
  return { ok: true, message: "Templates sincronizados com a Meta.", at: Date.now() };
}

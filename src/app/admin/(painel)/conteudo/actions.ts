"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withStaff, AuthError } from "@/server/auth";
import { dbErrorMessage, ConflictError } from "@/lib/db";
import { interpolate } from "@/lib/content";
import { readSettings, type PublicSettings } from "@/lib/settings";
import type { Branch } from "@/lib/branches";
import type { ActionState } from "@/components/admin/ActionForm";

const EDITORS = ["admin", "stock_manager"] as const;

function fail(err: unknown): ActionState {
  if (err instanceof AuthError || err instanceof ConflictError) return { ok: false, message: err.message };
  return { ok: false, message: dbErrorMessage(err) ?? (err as Error).message };
}

const pageInput = z.object({
  id: z.string().optional(),
  slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)*$/, "Usa minúsculas, números e hífens."),
  kind: z.enum(["page", "guide", "legal"]),
  title: z.string().trim().min(2).max(160),
  summary: z.string().trim().max(400).optional(),
  body: z.string().max(60000),
  status: z.enum(["draft", "needs_validation", "published"]),
  version: z.coerce.number().int().optional(),
});

export async function savePageAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = pageInput.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, fields: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const d = parsed.data;
  let id = d.id;
  try {
    await withStaff([...EDITORS], async (tx, s) => {
      if (d.kind === "legal" && s.profile.role !== "admin" && d.status === "published") throw new AuthError("Só um administrador publica textos legais.");
      if (d.status === "published") {
        // Não publica textos com dados por preencher
        const settings = (await readSettings(tx, ["company", "services", "legal", "financing"])) as unknown as PublicSettings;
        const branches = (await tx`select address_line, postal_code, city from app.branches where is_active and not is_demo`) as unknown as Branch[];
        const { missing } = interpolate(d.body, settings, branches);
        if (missing.length) throw new Error(`Não é possível publicar: faltam dados (${missing.join(", ")}). Preenche-os em Configuração.`);
        if (/\[Texto a escrever/.test(d.body)) throw new Error("Não é possível publicar: o texto ainda tem marcadores por escrever.");
      }
      const row = { slug: d.slug, kind: d.kind, title: d.title, summary: d.summary || null, body: d.body, status: d.status, updatedBy: s.profile.id };
      if (id) {
        const r = await tx`update app.site_pages set ${tx(row as never)}, published_at = case when ${d.status} = 'published' then coalesce(published_at, now()) else null end
          where id = ${id} and version = ${d.version ?? 0} returning id`;
        if (r.length === 0) throw new ConflictError();
      } else {
        const [r] = (await tx`insert into app.site_pages ${tx({ ...row, publishedAt: d.status === "published" ? new Date() : null } as never)} returning id`) as unknown as { id: string }[];
        id = r!.id;
      }
    });
  } catch (err) {
    return fail(err);
  }
  revalidatePath("/", "layout");
  if (!d.id) redirect(`/admin/conteudo/${id}`);
  return { ok: true, message: d.status === "published" ? "Publicado." : "Guardado (não publicado).", at: Date.now() };
}

export async function saveFaqAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("id") ?? "");
  const scope = z.enum(["general", "vehicle", "financing", "trade_in"]).safeParse(fd.get("scope"));
  const question = String(fd.get("question") ?? "").trim();
  const answer = String(fd.get("answer") ?? "").trim();
  const del = fd.get("delete") === "on";
  if (!scope.success || (!del && (!question || !answer))) return { ok: false, message: "Preenche pergunta e resposta." };
  try {
    await withStaff([...EDITORS], async (tx) => {
      if (id && del) await tx`delete from app.faqs where id = ${id}`;
      else if (id) await tx`update app.faqs set scope = ${scope.data}, question = ${question}, answer = ${answer}, position = ${Number(fd.get("position") ?? 0)}, is_published = ${fd.get("isPublished") === "on"}, updated_at = now() where id = ${id}`;
      else await tx`insert into app.faqs (scope, question, answer, position, is_published) values (${scope.data}, ${question}, ${answer}, ${Number(fd.get("position") ?? 0)}, ${fd.get("isPublished") === "on"})`;
    });
  } catch (err) {
    return fail(err);
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Pergunta guardada.", at: Date.now() };
}

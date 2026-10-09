import { env } from "@/lib/env";
import { staffOrNull, withStaff } from "@/server/auth";
import { readLocalObject } from "@/server/storage";

/** Só desenvolvimento (STORAGE_DRIVER=local): serve ficheiros privados a colaboradores com acesso ao contacto. */
export async function GET(_req: Request, ctx: RouteContext<"/admin/ficheiros/[...key]">) {
  if (env().STORAGE_DRIVER !== "local") return new Response("Não encontrado", { status: 404 });
  if (!(await staffOrNull(["admin", "sales"]))) return new Response("Sem acesso", { status: 403 });
  const key = (await ctx.params).key.map(decodeURIComponent).join("/");
  // Verifica por RLS que o colaborador pode ver a retoma a que o ficheiro pertence
  const allowed = await withStaff(["admin", "sales"], async (tx) => (await tx`select 1 from app.trade_in_media where storage_path = ${key}`).length > 0);
  if (!allowed) return new Response("Sem acesso", { status: 403 });
  const data = await readLocalObject("private-media", key);
  if (!data) return new Response("Não encontrado", { status: 404 });
  return new Response(new Uint8Array(data), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "Content-Security-Policy": "default-src 'none'", "X-Content-Type-Options": "nosniff" } });
}

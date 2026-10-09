import { env } from "@/lib/env";
import { readLocalObject } from "@/server/storage";

/**
 * Serve fotografias públicas guardadas localmente (só com STORAGE_DRIVER=local, em desenvolvimento).
 * Em produção as fotografias vêm do bucket público da Supabase. Nunca serve o bucket privado.
 */
export async function GET(_req: Request, ctx: RouteContext<"/media/[bucket]/[...path]">) {
  if (env().STORAGE_DRIVER !== "local") return new Response("Não encontrado", { status: 404 });
  const { bucket, path } = await ctx.params;
  if (bucket !== "vehicle-media") return new Response("Não encontrado", { status: 404 });
  const key = path.join("/");
  if (!/^[0-9a-f-]{36}\/[\w-]+-(480|960|1600)\.webp$/.test(key)) return new Response("Não encontrado", { status: 404 });
  const data = await readLocalObject("vehicle-media", key);
  if (!data) return new Response("Não encontrado", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'" },
  });
}

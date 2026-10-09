import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type Metadata as SharpMetadata } from "sharp";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { IMAGE_WIDTHS } from "@/lib/storage-url";

export type Bucket = "vehicle-media" | "private-media";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "heif", "avif"]);

export class UploadError extends Error {}

let supabaseAdmin: SupabaseClient | undefined;
function admin(): SupabaseClient {
  // Chave secreta usada SÓ no servidor. Nunca é enviada ao navegador.
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(env().NEXT_PUBLIC_SUPABASE_URL!, env().SUPABASE_SECRET_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseAdmin;
}

function localPath(bucket: Bucket, key: string) {
  // Só usado em desenvolvimento (STORAGE_DRIVER=local); excluído do rastreio de ficheiros do build
  const root = path.resolve(/*turbopackIgnore: true*/ process.cwd(), env().LOCAL_STORAGE_DIR, bucket);
  const full = path.resolve(/*turbopackIgnore: true*/ root, key);
  if (!full.startsWith(root + path.sep)) throw new UploadError("Caminho inválido.");
  return full;
}

async function put(bucket: Bucket, key: string, body: Buffer, contentType: string) {
  if (env().STORAGE_DRIVER === "local") {
    const full = localPath(bucket, key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
    return;
  }
  const { error } = await admin().storage.from(bucket).upload(key, body, { contentType, upsert: false, cacheControl: "31536000" });
  if (error) throw new UploadError(`Falha no armazenamento: ${error.message}`);
}

export async function removeObjects(bucket: Bucket, keys: string[]) {
  if (keys.length === 0) return;
  if (env().STORAGE_DRIVER === "local") {
    await Promise.all(keys.map((k) => rm(localPath(bucket, k), { force: true })));
    return;
  }
  const { error } = await admin().storage.from(bucket).remove(keys);
  if (error) throw new UploadError(`Falha ao remover ficheiros: ${error.message}`);
}

export async function readLocalObject(bucket: Bucket, key: string): Promise<Buffer | null> {
  if (env().STORAGE_DRIVER !== "local") return null;
  try {
    return await readFile(localPath(bucket, key));
  } catch {
    return null;
  }
}

/**
 * Valida o tipo REAL do ficheiro (descodificando-o, não pela extensão), corrige a orientação,
 * remove metadados (EXIF/GPS) e gera variantes WebP. Nada do ficheiro original é guardado.
 */
async function decode(input: Buffer) {
  if (input.byteLength === 0 || input.byteLength > MAX_UPLOAD_BYTES) {
    throw new UploadError("Cada fotografia pode ter no máximo 10 MB.");
  }
  let meta: SharpMetadata;
  try {
    meta = await sharp(input, { failOn: "error", limitInputPixels: 60_000_000 }).metadata();
  } catch {
    throw new UploadError("O ficheiro não é uma imagem válida.");
  }
  if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) {
    throw new UploadError("Formato não suportado. Usa JPEG, PNG, WebP ou HEIC.");
  }
  return meta;
}

export async function storeVehicleImage(vehicleId: string, input: Buffer) {
  await decode(input);
  const base = `${vehicleId}/${randomUUID()}`;
  let width = 0;
  let height = 0;
  for (const w of IMAGE_WIDTHS) {
    const { data, info } = await sharp(input, { failOn: "error" })
      .rotate()
      .resize({ width: w, withoutEnlargement: false, fit: "inside" })
      .webp({ quality: w >= 1600 ? 78 : 80 })
      .toBuffer({ resolveWithObject: true });
    await put("vehicle-media", `${base}-${w}.webp`, data, "image/webp");
    if (w === 1600) {
      width = info.width;
      height = info.height;
    }
  }
  return { storagePath: base, width, height };
}

export async function removeVehicleImage(storagePath: string) {
  await removeObjects(
    "vehicle-media",
    IMAGE_WIDTHS.map((w) => `${storagePath}-${w}.webp`),
  );
}

export async function storePrivateImage(prefix: string, input: Buffer) {
  await decode(input);
  const { data, info } = await sharp(input, { failOn: "error" })
    .rotate()
    .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  const key = `${prefix}/${randomUUID()}.jpg`;
  await put("private-media", key, data, "image/jpeg");
  return { path: key, mime: "image/jpeg", size: info.size };
}

/** URL temporária (5 min) para ficheiros privados, gerada só depois de verificar permissões. */
export async function signedPrivateUrl(key: string): Promise<string> {
  if (env().STORAGE_DRIVER === "local") {
    return `/admin/ficheiros/${encodeURIComponent(key)}`;
  }
  const { data, error } = await admin().storage.from("private-media").createSignedUrl(key, 300);
  if (error || !data) throw new UploadError("Não foi possível gerar o acesso ao ficheiro.");
  return data.signedUrl;
}

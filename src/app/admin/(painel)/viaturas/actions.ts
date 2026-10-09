"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthError, withStaff } from "@/server/auth";
import { ConflictError, dbErrorMessage } from "@/lib/db";
import { fieldErrors, vehicleEditorInput } from "@/lib/validation";
import { duplicateVehicle, saveVehicle, savePrivateDetails, setVehicleStatus } from "@/server/admin-vehicles";
import { removeVehicleImage, storeVehicleImage, UploadError } from "@/server/storage";
import { fetchRemoteImage, RemoteImageError } from "@/server/remote-image";
import type { ActionState } from "@/components/admin/ActionForm";
import { VEHICLE_STATUSES } from "@/lib/domain";
import { addDays } from "@/server/dates";

const STOCK = ["admin", "stock_manager"] as const;

function fail(err: unknown): ActionState {
  if (err instanceof AuthError) return { ok: false, message: err.message };
  if (err instanceof ConflictError) return { ok: false, message: err.message };
  if (err instanceof UploadError || err instanceof RemoteImageError) return { ok: false, message: err.message };
  const m = dbErrorMessage(err);
  if (m) return { ok: false, message: m };
  console.error("admin/viaturas", (err as Error).message);
  return { ok: false, message: "Não foi possível guardar. Tenta novamente." };
}

function revalidateVehicle(slug?: string) {
  revalidatePath("/");
  revalidatePath("/viaturas");
  if (slug) revalidatePath(`/viaturas/${slug}`);
  revalidatePath("/admin/viaturas");
}

function parseEditor(fd: FormData) {
  const obj: Record<string, unknown> = Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith("$") && k !== "featureIds" && !k.startsWith("fact_")));
  obj.featureIds = fd.getAll("featureIds").map(String);
  obj.isFeatured = fd.get("isFeatured") === "on";
  const facts: unknown[] = [];
  for (let i = 0; i < 10; i++) {
    const key = fd.get(`fact_${i}_key`);
    const value = String(fd.get(`fact_${i}_value`) ?? "").trim();
    if (key && value) facts.push({ key, value, source: String(fd.get(`fact_${i}_source`) ?? ""), verified_on: String(fd.get(`fact_${i}_date`) ?? "") });
  }
  obj.historyFacts = facts;
  return vehicleEditorInput.safeParse(obj);
}

export async function saveVehicleAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = (fd.get("id") as string) || undefined;
  const parsed = parseEditor(fd);
  if (!parsed.success) {
    const fields = fieldErrors(parsed.error);
    return { ok: false, fields, message: `Revê os campos assinalados: ${Object.values(fields).slice(0, 4).join(" ")}` };
  }
  let result: { id: string; slug: string };
  try {
    result = await withStaff([...STOCK], async (tx, s) => {
      const r = await saveVehicle(tx, s.profile.id, parsed.data, id);
      await savePrivateDetails(tx, r.id, parsed.data);
      return r;
    });
  } catch (err) {
    return fail(err);
  }
  revalidateVehicle(result.slug);
  if (!id) redirect(`/admin/viaturas/${result.id}?criada=1`);
  return { ok: true, message: "Alterações guardadas.", at: Date.now() };
}

export async function duplicateVehicleAction(fd: FormData) {
  const id = String(fd.get("id"));
  const newId = await withStaff([...STOCK], (tx, s) => duplicateVehicle(tx, s.profile.id, id));
  revalidatePath("/admin/viaturas");
  redirect(`/admin/viaturas/${newId}?duplicada=1`);
}

export async function setStatusAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("id"));
  const status = z.enum(VEHICLE_STATUSES).safeParse(fd.get("status"));
  const version = Number(fd.get("version"));
  if (!status.success) return { ok: false, message: "Estado inválido." };
  try {
    const slug = await withStaff([...STOCK], async (tx, s) => {
      await setVehicleStatus(tx, s.profile.id, id, status.data, version);
      const [v] = (await tx`select slug from app.vehicles where id = ${id}`) as unknown as { slug: string }[];
      return v?.slug;
    });
    revalidateVehicle(slug);
  } catch (err) {
    return fail(err);
  }
  revalidatePath(`/admin/viaturas/${id}`);
  return { ok: true, message: "Estado atualizado.", at: Date.now() };
}

export async function reserveAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("id"));
  const days = Number(fd.get("days") ?? 3);
  const leadId = (fd.get("leadId") as string) || null;
  const note = String(fd.get("note") ?? "").slice(0, 500) || null;
  if (!Number.isInteger(days) || days < 1 || days > 30) return { ok: false, message: "Indica uma duração entre 1 e 30 dias." };
  if (leadId && !/^[0-9a-f-]{36}$/.test(leadId)) return { ok: false, message: "Contacto inválido." };
  try {
    await withStaff(["admin", "stock_manager", "sales"], (tx) => tx`select app.reserve_vehicle(${id}, ${leadId}, ${addDays(new Date(), days)}, ${note})`);
  } catch (err) {
    return fail(err);
  }
  revalidateVehicle();
  revalidatePath(`/admin/viaturas/${id}`);
  return { ok: true, message: `Reservada por ${days} dia(s).`, at: Date.now() };
}

export async function closeReservationAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  const reservationId = String(fd.get("reservationId"));
  const outcome = z.enum(["cancelled", "converted"]).safeParse(fd.get("outcome"));
  const reason = String(fd.get("reason") ?? "").slice(0, 300) || null;
  if (!outcome.success) return { ok: false, message: "Opção inválida." };
  try {
    await withStaff(["admin", "stock_manager", "sales"], (tx) => tx`select app.close_reservation(${reservationId}, ${outcome.data}, ${reason})`);
  } catch (err) {
    return fail(err);
  }
  revalidateVehicle();
  revalidatePath("/admin/viaturas", "layout");
  return { ok: true, message: outcome.data === "converted" ? "Viatura marcada como vendida." : "Reserva cancelada e viatura disponível.", at: Date.now() };
}

// ---------------------------------------------------------------------------
// Fotografias
// ---------------------------------------------------------------------------
async function addMedia(vehicleId: string, buffers: Buffer[]) {
  const stored: Awaited<ReturnType<typeof storeVehicleImage>>[] = [];
  for (const b of buffers) stored.push(await storeVehicleImage(vehicleId, b));
  try {
    await withStaff([...STOCK], async (tx) => {
      const [{ max, covers }] = (await tx`select coalesce(max(position), -1)::int as max, count(*) filter (where is_cover)::int as covers
        from app.vehicle_media where vehicle_id = ${vehicleId}`) as unknown as [{ max: number; covers: number }];
      let pos = max + 1;
      for (const [i, s] of stored.entries()) {
        await tx`insert into app.vehicle_media (vehicle_id, storage_path, width, height, position, is_cover)
                 values (${vehicleId}, ${s.storagePath}, ${s.width}, ${s.height}, ${pos++}, ${covers === 0 && i === 0})`;
      }
    });
  } catch (err) {
    await Promise.all(stored.map((s) => removeVehicleImage(s.storagePath).catch(() => {})));
    throw err;
  }
  return stored.length;
}

export async function uploadMediaAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  const vehicleId = String(fd.get("vehicleId"));
  const files = fd.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { ok: false, message: "Escolhe pelo menos uma fotografia." };
  if (files.length > 30) return { ok: false, message: "Carrega no máximo 30 fotografias de cada vez." };
  try {
    const n = await addMedia(vehicleId, await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer()))));
    revalidateVehicle();
    revalidatePath(`/admin/viaturas/${vehicleId}`);
    return { ok: true, message: `${n} fotografia(s) carregada(s).`, at: Date.now() };
  } catch (err) {
    return fail(err);
  }
}

export async function importMediaUrlsAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  const vehicleId = String(fd.get("vehicleId"));
  const urls = String(fd.get("urls") ?? "")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);
  if (urls.length === 0) return { ok: false, message: "Cola pelo menos um URL." };
  const buffers: Buffer[] = [];
  const errors: string[] = [];
  for (const [i, u] of urls.entries()) {
    try {
      buffers.push(await fetchRemoteImage(u));
    } catch (err) {
      errors.push(`URL ${i + 1}: ${(err as Error).message}`);
    }
  }
  try {
    const n = buffers.length ? await addMedia(vehicleId, buffers) : 0;
    revalidateVehicle();
    revalidatePath(`/admin/viaturas/${vehicleId}`);
    return { ok: errors.length === 0, message: `${n} fotografia(s) importada(s).${errors.length ? ` Falharam ${errors.length}: ${errors.slice(0, 3).join("; ")}` : ""}`, at: Date.now() };
  } catch (err) {
    return fail(err);
  }
}

export async function mediaOpAction(fd: FormData) {
  const vehicleId = String(fd.get("vehicleId"));
  const mediaId = String(fd.get("mediaId"));
  const op = String(fd.get("op"));
  let removedPath: string | null = null;
  await withStaff([...STOCK], async (tx) => {
    const items = (await tx`select id, position, storage_path from app.vehicle_media where vehicle_id = ${vehicleId} order by position, created_at`) as unknown as { id: string; position: number; storagePath: string }[];
    const idx = items.findIndex((m) => m.id === mediaId);
    if (idx < 0) return;
    if (op === "cover") {
      await tx`update app.vehicle_media set is_cover = false where vehicle_id = ${vehicleId}`;
      await tx`update app.vehicle_media set is_cover = true where id = ${mediaId}`;
    } else if (op === "up" || op === "down") {
      const j = op === "up" ? idx - 1 : idx + 1;
      if (j < 0 || j >= items.length) return;
      const order = items.map((m) => m.id);
      [order[idx], order[j]] = [order[j]!, order[idx]!];
      for (const [p, id] of order.entries()) await tx`update app.vehicle_media set position = ${p} where id = ${id}`;
    } else if (op === "alt") {
      const alt = String(fd.get("alt") ?? "").trim().slice(0, 200) || null;
      await tx`update app.vehicle_media set alt_text = ${alt} where id = ${mediaId}`;
    } else if (op === "delete") {
      const wasCover = ((await tx`delete from app.vehicle_media where id = ${mediaId} returning is_cover`) as unknown as { isCover: boolean }[])[0]?.isCover;
      removedPath = items[idx]!.storagePath;
      if (wasCover) {
        await tx`update app.vehicle_media set is_cover = true where id = (select id from app.vehicle_media where vehicle_id = ${vehicleId} order by position limit 1)`;
      }
    }
  });
  if (removedPath) await removeVehicleImage(removedPath).catch((e) => console.error("remover imagem", e));
  revalidateVehicle();
  revalidatePath(`/admin/viaturas/${vehicleId}`);
}

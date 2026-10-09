"use server";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withStaff, AuthError } from "@/server/auth";
import { dbErrorMessage } from "@/lib/db";
import { parseStockCsv, type ParsedRow } from "@/lib/stock-csv";
import { saveVehicle } from "@/server/admin-vehicles";
import { fetchRemoteImage } from "@/server/remote-image";
import { storeVehicleImage } from "@/server/storage";
import type { ActionState } from "@/components/admin/ActionForm";

const STOCK = ["admin", "stock_manager"] as const;

/** Passo 1: ensaio sem escrita no stock. Grava o relatório para confirmação. */
export async function previewImportAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  const file = fd.get("file");
  const mode = fd.get("mode") === "full_snapshot" ? "full_snapshot" : "partial_update";
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Escolhe um ficheiro CSV." };
  if (file.size > 1024 * 1024) return { ok: false, message: "O ficheiro tem mais de 1 MB." };
  const text = await file.text();
  const { rows, headerErrors } = parseStockCsv(text);
  if (headerErrors.some((e) => e.startsWith("Falta"))) return { ok: false, message: headerErrors.join(" ") };
  let jobId: string;
  try {
    jobId = await withStaff([...STOCK], async (tx, s) => {
      const refs = rows.map((r) => r.reference).filter((x): x is string => Boolean(x));
      const existing = refs.length ? ((await tx`select reference from app.vehicles where reference in ${tx(refs)}`) as unknown as { reference: string }[]).map((r) => r.reference) : [];
      for (const r of rows) {
        if (r.action === "update" && !existing.includes(r.reference!)) {
          r.errors.push(`referencia ${r.reference} não existe (para criar, deixa a referência vazia)`);
          r.action = "skip";
        }
      }
      let missingFromFile: string[] = [];
      if (mode === "full_snapshot") {
        missingFromFile = ((await tx`select reference from app.vehicles where status in ('available', 'reserved') and not (reference = any(${refs}::text[]))`) as unknown as { reference: string }[]).map((r) => r.reference);
      }
      const report = { headerErrors, rows, missingFromFile };
      const [job] = (await tx`insert into app.import_jobs (filename, mode, created_by, rows_total, rows_rejected, report, file_sha256)
        values (${file.name.slice(0, 200)}, ${mode}, ${s.profile.id}, ${rows.length}, ${rows.filter((r) => r.action === "skip").length}, ${tx.json(report as never)},
                ${createHash("sha256").update(text).digest("hex")}) returning id`) as unknown as { id: string }[];
      return job!.id;
    });
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, message: err.message };
    return { ok: false, message: dbErrorMessage(err) ?? "Não foi possível analisar o ficheiro." };
  }
  redirect(`/admin/importar?job=${jobId}`);
}

/** Passo 2: aplica as linhas válidas do ensaio confirmado. Ausências NUNCA vendem nem apagam viaturas. */
export async function commitImportAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  const jobId = String(fd.get("jobId"));
  try {
    const summary = await withStaff([...STOCK], async (tx, s) => {
      const [job] = (await tx`select id, status, report from app.import_jobs where id = ${jobId} for update`) as unknown as { id: string; status: string; report: { rows: ParsedRow[] } }[];
      if (!job) throw new Error("Importação não encontrada.");
      if (job.status !== "previewed") throw new Error("Esta importação já foi aplicada ou descartada.");
      let created = 0;
      let updated = 0;
      const photoJobs: { vehicleId: string; urls: string[] }[] = [];
      const features = (await tx`select id, lower(name) as name from app.features`) as unknown as { id: string; name: string }[];
      for (const r of job.report.rows) {
        if (r.action === "skip" || !r.data) continue;
        const featureIds = r.features.map((f) => features.find((x) => x.name === f.toLowerCase())?.id).filter((x): x is string => Boolean(x));
        let id: string | undefined;
        if (r.action === "update") {
          const [v] = (await tx`select id, version from app.vehicles where reference = ${r.reference}`) as unknown as { id: string; version: number }[];
          if (!v) continue;
          id = v.id;
          await saveVehicle(tx, s.profile.id, { ...r.data, featureIds, expectedVersion: v.version }, v.id);
          updated++;
        } else {
          const res = await saveVehicle(tx, s.profile.id, { ...r.data, featureIds });
          id = res.id;
          created++;
        }
        if (r.photos.length && id) photoJobs.push({ vehicleId: id, urls: r.photos });
      }
      await tx`update app.import_jobs set status = 'committed', committed_at = now(), rows_created = ${created}, rows_updated = ${updated} where id = ${jobId}`;
      return { created, updated, photoJobs };
    });
    // Fotografias por URL: fora da transação; falhas não bloqueiam os restantes dados
    const photoErrors: string[] = [];
    for (const pj of summary.photoJobs) {
      for (const url of pj.urls) {
        try {
          const img = await storeVehicleImage(pj.vehicleId, await fetchRemoteImage(url));
          await withStaff([...STOCK], async (tx) => {
            const [{ n }] = (await tx`select count(*)::int as n from app.vehicle_media where vehicle_id = ${pj.vehicleId}`) as unknown as [{ n: number }];
            await tx`insert into app.vehicle_media (vehicle_id, storage_path, width, height, position, is_cover) values (${pj.vehicleId}, ${img.storagePath}, ${img.width}, ${img.height}, ${n}, ${n === 0})`;
          });
        } catch (err) {
          photoErrors.push(`${url.slice(0, 60)}…: ${(err as Error).message}`);
        }
      }
    }
    revalidatePath("/", "layout");
    return {
      ok: photoErrors.length === 0,
      message: `Importação aplicada: ${summary.created} criada(s), ${summary.updated} atualizada(s).${photoErrors.length ? ` ${photoErrors.length} fotografia(s) falharam: ${photoErrors.slice(0, 3).join("; ")}` : ""}`,
      at: Date.now(),
    };
  } catch (err) {
    return { ok: false, message: dbErrorMessage(err) ?? (err as Error).message };
  }
}

export async function discardImportAction(fd: FormData) {
  const jobId = String(fd.get("jobId"));
  await withStaff([...STOCK], (tx) => tx`update app.import_jobs set status = 'discarded' where id = ${jobId} and status = 'previewed'`);
  redirect("/admin/importar");
}

"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withStaff, AuthError } from "@/server/auth";
import { dbErrorMessage } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { SERVICES } from "@/lib/domain";
import { SETTINGS_SCHEMAS, type SettingsKey } from "@/lib/settings";
import { slugify } from "@/lib/format";
import type { ActionState } from "@/components/admin/ActionForm";

function fail(err: unknown): ActionState {
  if (err instanceof AuthError) return { ok: false, message: err.message };
  return { ok: false, message: dbErrorMessage(err) ?? (err as Error).message ?? "Não foi possível guardar." };
}

const str = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};

async function saveSetting(key: SettingsKey, value: unknown, isPublic: boolean) {
  const parsed = SETTINGS_SCHEMAS[key].parse(value);
  await withStaff(["admin"], async (tx, s) => {
    await tx`insert into app.site_settings (key, value, is_public, updated_by) values (${key}, ${tx.json(parsed as never)}, ${isPublic}, ${s.profile.id})
             on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`;
  });
  revalidatePath("/", "layout");
}

export async function saveCompanyAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  const fields: Record<string, string> = {};
  const phone = str(fd, "phone");
  const wa = str(fd, "whatsapp");
  const phoneE164 = phone ? normalizePhone(phone) : null;
  const whatsappE164 = wa ? normalizePhone(wa) : null;
  if (phone && !phoneE164) fields.phone = "Telefone inválido.";
  if (wa && !whatsappE164) fields.whatsapp = "Número inválido.";
  const nif = str(fd, "nif");
  if (nif && !/^\d{9}$/.test(nif)) fields.nif = "O NIF tem 9 algarismos.";
  for (const k of ["email", "privacyEmail"]) {
    const v = str(fd, k);
    if (v && !z.email().safeParse(v).success) fields[k] = "Email inválido.";
  }
  for (const k of ["instagramUrl", "facebookUrl"]) {
    const v = str(fd, k);
    if (v && !/^https:\/\//.test(v)) fields[k] = "Usa um endereço https://";
  }
  if (Object.keys(fields).length) return { ok: false, fields };
  try {
    await saveSetting(
      "company",
      {
        tradeName: str(fd, "tradeName") ?? "Inova Auto",
        legalName: str(fd, "legalName"),
        nif,
        email: str(fd, "email"),
        phoneE164,
        whatsappE164,
        instagramUrl: str(fd, "instagramUrl"),
        facebookUrl: str(fd, "facebookUrl"),
        privacyEmail: str(fd, "privacyEmail"),
        valueProposition: str(fd, "valueProposition"),
        aboutText: str(fd, "aboutText"),
      },
      true,
    );
  } catch (err) {
    return fail(err);
  }
  return { ok: true, message: "Dados da empresa guardados.", at: Date.now() };
}

export async function saveServicesAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await saveSetting("services", Object.fromEntries(SERVICES.map((s) => [s, fd.get(s) === "on"])), true);
  } catch (err) {
    return fail(err);
  }
  return { ok: true, message: "Serviços atualizados. Os serviços desligados ficam ocultos no site.", at: Date.now() };
}

export async function saveLegalAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  const url = (k: string) => {
    const v = str(fd, k);
    return v && /^https:\/\//.test(v) ? v : null;
  };
  try {
    await saveSetting(
      "legal",
      {
        complaintsBookUrl: url("complaintsBookUrl"),
        ralEntityName: str(fd, "ralEntityName"),
        ralEntityUrl: url("ralEntityUrl"),
        ralEntityAddress: str(fd, "ralEntityAddress"),
        creditIntermediaryText: str(fd, "creditIntermediaryText"),
        dataRetentionText: str(fd, "dataRetentionText"),
        consentVersion: str(fd, "consentVersion") ?? "2026-10-08",
      },
      true,
    );
  } catch (err) {
    return fail(err);
  }
  return { ok: true, message: "Informação legal guardada.", at: Date.now() };
}

export async function saveCrmAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await saveSetting(
      "crm",
      {
        autoAssign: fd.get("autoAssign") === "on",
        unansweredAlertMinutes: Number(fd.get("unansweredAlertMinutes")),
        reservationDefaultDays: Number(fd.get("reservationDefaultDays")),
        appointmentSlotMinutes: Number(fd.get("appointmentSlotMinutes")),
      },
      false,
    );
  } catch (err) {
    if (err instanceof z.ZodError) return { ok: false, message: "Valores fora dos limites permitidos." };
    return fail(err);
  }
  return { ok: true, message: "Regras do CRM guardadas.", at: Date.now() };
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export async function saveBranchAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  const name = str(fd, "name");
  if (!name) return { ok: false, fields: { name: "Indica o nome." } };
  const postal = str(fd, "postalCode");
  if (postal && !/^\d{4}-\d{3}$/.test(postal)) return { ok: false, fields: { postalCode: "Formato 0000-000." } };
  const phone = str(fd, "phone");
  const phoneE164 = phone ? normalizePhone(phone) : null;
  if (phone && !phoneE164) return { ok: false, fields: { phone: "Telefone inválido." } };
  const lat = str(fd, "latitude");
  const lng = str(fd, "longitude");
  const hours: Record<string, [string, string][]> = {};
  for (const d of DAYS) {
    const intervals: [string, string][] = [];
    for (const i of [1, 2]) {
      const a = str(fd, `${d}_${i}_open`);
      const b = str(fd, `${d}_${i}_close`);
      if (a && b) {
        if (!/^\d{2}:\d{2}$/.test(a) || !/^\d{2}:\d{2}$/.test(b) || a >= b) return { ok: false, message: `Horário inválido (${d}).` };
        intervals.push([a, b]);
      }
    }
    if (intervals.length) hours[d] = intervals;
  }
  const row = {
    name,
    addressLine: str(fd, "addressLine"),
    postalCode: postal,
    city: str(fd, "city"),
    latitude: lat ? Number(lat.replace(",", ".")) : null,
    longitude: lng ? Number(lng.replace(",", ".")) : null,
    phoneE164,
    email: str(fd, "email"),
    mapsUrl: str(fd, "mapsUrl"),
    isActive: fd.get("isActive") === "on",
  };
  if ((row.latitude !== null && !Number.isFinite(row.latitude)) || (row.longitude !== null && !Number.isFinite(row.longitude))) return { ok: false, message: "Coordenadas inválidas." };
  if (row.mapsUrl && !/^https:\/\//.test(row.mapsUrl)) return { ok: false, fields: { mapsUrl: "Usa um endereço https://" } };
  try {
    await withStaff(["admin"], async (tx) => {
      if (id) {
        await tx`update app.branches set ${tx(row as never)}, opening_hours = ${tx.json(hours)} where id = ${id}`;
      } else {
        await tx`insert into app.branches ${tx({ ...row, slug: slugify(name) || "stand" } as never)}`;
        await tx`update app.branches set opening_hours = ${tx.json(hours)} where slug = ${slugify(name) || "stand"}`;
      }
    });
  } catch (err) {
    return fail(err);
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Instalação guardada.", at: Date.now() };
}

export async function addClosureAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  const branchId = str(fd, "branchId");
  const date = str(fd, "date");
  if (!branchId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: "Indica a data." };
  try {
    await withStaff(["admin"], (tx) => tx`insert into app.branch_closures (branch_id, closed_on, reason) values (${branchId}, ${date}, ${str(fd, "reason")}) on conflict do nothing`);
  } catch (err) {
    return fail(err);
  }
  revalidatePath("/admin/configuracao");
  return { ok: true, message: "Dia de encerramento adicionado.", at: Date.now() };
}


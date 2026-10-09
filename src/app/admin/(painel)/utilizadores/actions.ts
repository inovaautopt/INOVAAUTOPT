"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { AuthError, withStaff } from "@/server/auth";
import { asSystem, dbErrorMessage } from "@/lib/db";
import { env } from "@/lib/env";
import { STAFF_ROLES } from "@/lib/domain";
import type { ActionState } from "@/components/admin/ActionForm";

function fail(err: unknown): ActionState {
  if (err instanceof AuthError) return { ok: false, message: err.message };
  return { ok: false, message: dbErrorMessage(err) ?? (err as Error).message };
}

const invite = z.object({
  fullName: z.string().trim().min(2, "Indica o nome.").max(120),
  email: z.string().trim().toLowerCase().pipe(z.email("Email inválido.")),
  role: z.enum(STAFF_ROLES),
});

/** Convida um colaborador: a Supabase envia um email para ele definir a palavra-passe. Sem inscrição pública. */
export async function inviteUserAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = invite.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, fields: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  try {
    await withStaff(["admin"], async () => {}); // confirma permissão antes de usar a chave de serviço
    let userId: string;
    if (env().AUTH_PROVIDER === "dev") {
      const [u] = (await asSystem((tx) => tx`insert into auth.users (email) values (${parsed.data.email}) on conflict (email) do update set email = excluded.email returning id`)) as unknown as { id: string }[];
      userId = u!.id;
    } else {
      const admin = createClient(env().NEXT_PUBLIC_SUPABASE_URL!, env().SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
      const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
        redirectTo: new URL("/admin/auth/callback?next=/admin/nova-palavra-passe", env().NEXT_PUBLIC_SITE_URL).toString(),
      });
      if (error || !data.user) return { ok: false, message: `Não foi possível convidar: ${error?.message ?? "erro desconhecido"}` };
      userId = data.user.id;
    }
    await withStaff(["admin"], (tx) => tx`insert into app.profiles (id, full_name, email, role) values (${userId}, ${parsed.data.fullName}, ${parsed.data.email}, ${parsed.data.role})
      on conflict (id) do update set full_name = excluded.full_name, role = excluded.role, is_active = true`);
  } catch (err) {
    return fail(err);
  }
  revalidatePath("/admin/utilizadores");
  return { ok: true, message: env().AUTH_PROVIDER === "dev" ? "Colaborador criado (modo de desenvolvimento)." : "Convite enviado por email.", at: Date.now() };
}

export async function updateUserAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("id"));
  const role = z.enum(STAFF_ROLES).safeParse(fd.get("role"));
  if (!role.success) return { ok: false, message: "Perfil inválido." };
  const isActive = fd.get("isActive") === "on";
  try {
    await withStaff(["admin"], async (tx, s) => {
      if (id === s.profile.id && (!isActive || role.data !== "admin")) throw new Error("Não podes retirar o teu próprio acesso de administrador.");
      if (!isActive || role.data !== "admin") {
        const [{ n }] = (await tx`select count(*)::int as n from app.profiles where role = 'admin' and is_active and id <> ${id}`) as unknown as [{ n: number }];
        if (n === 0) throw new Error("Tem de existir pelo menos um administrador ativo.");
      }
      await tx`update app.profiles set role = ${role.data}, is_active = ${isActive}, receives_leads = ${fd.get("receivesLeads") === "on"},
               can_see_unassigned = ${fd.get("canSeeUnassigned") === "on"} where id = ${id}`;
    });
  } catch (err) {
    return fail(err);
  }
  revalidatePath("/admin/utilizadores");
  return { ok: true, message: "Colaborador atualizado.", at: Date.now() };
}

export async function addAbsenceAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  const profileId = String(fd.get("profileId"));
  const from = String(fd.get("from"));
  const to = String(fd.get("to") || from);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) return { ok: false, message: "Datas inválidas." };
  try {
    await withStaff(["admin"], (tx) => tx`insert into app.staff_absences (profile_id, starts_on, ends_on, note) values (${profileId}, ${from}, ${to}, ${String(fd.get("note") ?? "") || null})`);
  } catch (err) {
    return fail(err);
  }
  revalidatePath("/admin/utilizadores");
  return { ok: true, message: "Ausência registada: não recebe contactos automáticos nesses dias.", at: Date.now() };
}

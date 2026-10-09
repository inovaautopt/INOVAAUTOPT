import { requireStaff, withStaff } from "@/server/auth";
import { PageHeader } from "@/components/admin/ui";
import { ActionForm, FieldMsg } from "@/components/admin/ActionForm";
import { STAFF_ROLES, STAFF_ROLE_LABEL, type StaffRole } from "@/lib/domain";
import { formatDate, formatShortDateTime } from "@/lib/format";
import { inviteUserAction, updateUserAction, addAbsenceAction } from "./actions";

export default async function Users() {
  await requireStaff(["admin"]);
  const { users, absences } = await withStaff(["admin"], async (tx) => ({
    users: (await tx`select id, full_name, email, role, is_active, receives_leads, can_see_unassigned, last_assigned_at from app.profiles order by is_active desc, full_name`) as unknown as {
      id: string; fullName: string; email: string; role: StaffRole; isActive: boolean; receivesLeads: boolean; canSeeUnassigned: boolean; lastAssignedAt: Date | null;
    }[],
    absences: (await tx`select a.starts_on::text as starts_on, a.ends_on::text as ends_on, a.note, p.full_name from app.staff_absences a join app.profiles p on p.id = a.profile_id where a.ends_on >= current_date order by a.starts_on`) as unknown as {
      startsOn: string; endsOn: string; note: string | null; fullName: string;
    }[],
  }));
  return (
    <>
      <PageHeader title="Utilizadores" description="Administrador: tudo, incluindo utilizadores e integrações (com verificação em dois passos). Gestor de stock: viaturas e conteúdo, sem contactos. Vendedor: contactos atribuídos, fila central e visitas; não altera preços." />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-3">
          {users.map((u) => (
            <div key={u.id} className="panel p-4">
              <ActionForm action={updateUserAction} submitLabel="Guardar" submitClassName="btn-sm">
                <input type="hidden" name="id" value={u.id} />
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-48 flex-1">
                    <p className="font-semibold">{u.fullName}</p>
                    <p className="text-xs text-muted">{u.email}{u.lastAssignedAt ? ` · último contacto atribuído ${formatShortDateTime(u.lastAssignedAt)}` : ""}</p>
                  </div>
                  <select name="role" defaultValue={u.role} className="input max-w-[12rem]" aria-label="Perfil">
                    {STAFF_ROLES.map((r) => (
                      <option key={r} value={r}>{STAFF_ROLE_LABEL[r]}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={u.isActive} className="check" /> Ativo</label>
                  <label className="flex items-center gap-2"><input type="checkbox" name="receivesLeads" defaultChecked={u.receivesLeads} className="check" /> Recebe contactos automáticos</label>
                  <label className="flex items-center gap-2"><input type="checkbox" name="canSeeUnassigned" defaultChecked={u.canSeeUnassigned} className="check" /> Vê a fila central</label>
                </div>
              </ActionForm>
            </div>
          ))}
        </div>
        <aside className="space-y-6">
          <section className="panel p-4">
            <h2 className="heading text-base">Convidar colaborador</h2>
            <ActionForm action={inviteUserAction} submitLabel="Enviar convite" submitClassName="btn-sm" resetOnSuccess className="mt-3">
              <>
                <>
                  <input name="fullName" className="input" placeholder="Nome" aria-label="Nome" />
                  <FieldMsg name="fullName" />
                  <input name="email" type="email" className="input" placeholder="Email" aria-label="Email" />
                  <FieldMsg name="email" />
                  <select name="role" defaultValue="sales" className="input" aria-label="Perfil">
                    {STAFF_ROLES.map((r) => (
                      <option key={r} value={r}>{STAFF_ROLE_LABEL[r]}</option>
                    ))}
                  </select>
                </>
              </>
            </ActionForm>
          </section>
          <section className="panel p-4">
            <h2 className="heading text-base">Ausências</h2>
            <ActionForm action={addAbsenceAction} submitLabel="Registar" submitClassName="btn-sm" resetOnSuccess className="mt-3">
              <select name="profileId" className="input" aria-label="Colaborador">
                {users.filter((u) => u.isActive).map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" name="from" className="input" aria-label="De" />
                <input type="date" name="to" className="input" aria-label="Até" />
              </div>
              <input name="note" className="input" placeholder="Nota (opcional)" aria-label="Nota" />
            </ActionForm>
            <ul className="mt-3 space-y-1 text-sm">
              {absences.map((a, i) => (
                <li key={i}>{a.fullName}: {formatDate(a.startsOn)} – {formatDate(a.endsOn)}{a.note ? ` (${a.note})` : ""}</li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}

import { requireStaff, withStaff } from "@/server/auth";
import { PageHeader } from "@/components/admin/ui";
import { formatShortDateTime } from "@/lib/format";

export default async function Audit(props: PageProps<"/admin/auditoria">) {
  await requireStaff(["admin"]);
  const sp = await props.searchParams;
  const entity = typeof sp.entidade === "string" && /^[a-z_]+$/.test(sp.entidade) ? sp.entidade : null;
  const rows = await withStaff(["admin"], async (tx) =>
    (await tx`select a.id, a.action, a.entity, a.entity_id, a.data, a.created_at, p.full_name from app.audit_logs a left join app.profiles p on p.id = a.actor_id
      ${entity ? tx`where a.entity = ${entity}` : tx``} order by a.created_at desc limit 300`) as unknown as {
      id: number; action: string; entity: string; entityId: string | null; data: Record<string, unknown>; createdAt: Date; fullName: string | null;
    }[],
  );
  return (
    <>
      <PageHeader title="Auditoria" description="Registo só de leitura de alterações de stock, preços, publicação, atribuições, utilizadores, importações e exportações. Dados pessoais e privados aparecem apenas como «alterado»." />
      <form className="mb-4 flex gap-2" method="get">
        <select name="entidade" defaultValue={entity ?? ""} className="input max-w-xs" aria-label="Entidade">
          <option value="">Tudo</option>
          {["vehicles", "vehicle_private_details", "leads", "appointments", "vehicle_reservations", "profiles", "site_settings", "site_pages", "import_jobs"].map((x) => (
            <option key={x} value={x}>{x}</option>
          ))}
        </select>
        <button className="btn btn-dark">Filtrar</button>
      </form>
      <div className="panel overflow-x-auto">
        <table className="table">
          <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Entidade</th><th>Alterações</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="num whitespace-nowrap">{formatShortDateTime(r.createdAt)}</td>
                <td>{r.fullName ?? "Sistema"}</td>
                <td>{r.action}</td>
                <td className="text-xs">{r.entity}<span className="block font-mono text-muted">{r.entityId?.slice(0, 8)}</span></td>
                <td className="max-w-xl font-mono text-[0.7rem] break-all">{JSON.stringify(r.data).slice(0, 400)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

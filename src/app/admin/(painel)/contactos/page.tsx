import Link from "next/link";
import { requireStaff, withStaff } from "@/server/auth";
import { PageHeader, LeadStatusTag, Empty } from "@/components/admin/ui";
import { formatShortDateTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { LEAD_KIND_LABEL, LEAD_SOURCE_LABEL, LEAD_STATUSES, LEAD_STATUS_LABEL, type LeadKind, type LeadSource, type LeadStatus } from "@/lib/domain";
import { getCrmSettings } from "@/lib/settings";

export default async function Leads(props: PageProps<"/admin/contactos">) {
  const s = await requireStaff(["admin", "sales"]);
  const sp = await props.searchParams;
  const estado = typeof sp.estado === "string" && (LEAD_STATUSES as readonly string[]).includes(sp.estado) ? sp.estado : null;
  const responsavel = typeof sp.responsavel === "string" ? sp.responsavel : "";
  const semResposta = sp.sem_resposta === "1";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  const crm = await getCrmSettings();
  const { rows, staff } = await withStaff(undefined, async (tx) => {
    const like = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    const rows = (await tx`
      select l.id, l.name, l.kind, l.source, l.status, l.created_at, l.vehicle_reference, l.phone_e164, l.email, l.next_action, l.next_action_at,
             l.first_response_at, p.full_name as assignee
      from app.leads l left join app.profiles p on p.id = l.assigned_to
      where true
        ${estado ? tx`and l.status = ${estado}` : tx`and l.status not in ('won', 'lost', 'archived')`}
        ${responsavel === "nenhum" ? tx`and l.assigned_to is null` : responsavel === "eu" ? tx`and l.assigned_to = ${s.profile.id}` : /^[0-9a-f-]{36}$/.test(responsavel) ? tx`and l.assigned_to = ${responsavel}` : tx``}
        ${semResposta ? tx`and l.first_response_at is null and l.status in ('new', 'assigned') and l.created_at < now() - make_interval(mins => ${crm.unansweredAlertMinutes})` : tx``}
        ${q ? tx`and (l.name ilike ${like} or l.email ilike ${like} or l.phone_e164 ilike ${like} or coalesce(l.vehicle_reference, '') ilike ${like})` : tx``}
      order by l.created_at desc limit 300`) as unknown as {
      id: string; name: string; kind: LeadKind; source: LeadSource; status: LeadStatus; createdAt: Date; vehicleReference: string | null; phoneE164: string | null;
      email: string | null; nextAction: string | null; nextActionAt: Date | null; firstResponseAt: Date | null; assignee: string | null;
    }[];
    const staff = (await tx`select id, full_name from app.profiles where is_active and role in ('admin', 'sales') order by full_name`) as unknown as { id: string; fullName: string }[];
    return { rows, staff };
  });
  return (
    <>
      <PageHeader
        title="Contactos"
        description="Pedidos do site, WhatsApp, telefone e presenciais. Estados de contacto, independentes do estado das viaturas."
        actions={
          <>
            {s.profile.role === "admin" && (
              <a href="/admin/contactos/exportar" download className="btn btn-outline">
                Exportar CSV
              </a>
            )}
            <Link href="/admin/contactos/novo" className="btn btn-primary">
              Registar contacto
            </Link>
          </>
        }
      />
      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <input name="q" defaultValue={q} placeholder="Nome, email, telefone ou referência" className="input max-w-xs" aria-label="Pesquisar" />
        <select name="estado" defaultValue={estado ?? ""} className="input max-w-[12rem]" aria-label="Estado">
          <option value="">Em aberto</option>
          {LEAD_STATUSES.map((st) => (
            <option key={st} value={st}>
              {LEAD_STATUS_LABEL[st]}
            </option>
          ))}
        </select>
        <select name="responsavel" defaultValue={responsavel} className="input max-w-[14rem]" aria-label="Responsável">
          <option value="">Todos os responsáveis</option>
          <option value="eu">Os meus</option>
          <option value="nenhum">Fila central (sem responsável)</option>
          {s.profile.role === "admin" &&
            staff.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="sem_resposta" value="1" defaultChecked={semResposta} className="check" /> Sem resposta
        </label>
        <button className="btn btn-dark">Filtrar</button>
      </form>
      {rows.length === 0 ? (
        <Empty>Não há contactos com estes critérios.</Empty>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Recebido</th>
                <th>Nome</th>
                <th>Contacto</th>
                <th>Tipo / origem</th>
                <th>Viatura</th>
                <th>Estado</th>
                <th>Responsável</th>
                <th>Próxima ação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td className="num whitespace-nowrap">{formatShortDateTime(l.createdAt)}</td>
                  <td>
                    <Link href={`/admin/contactos/${l.id}`} className="font-semibold hover:underline">
                      {l.name}
                    </Link>
                    {!l.firstResponseAt && (l.status === "new" || l.status === "assigned") && <span className="tag tag-danger ml-1">Sem resposta</span>}
                  </td>
                  <td className="text-xs">
                    {l.phoneE164 && <span className="block num">{formatPhone(l.phoneE164)}</span>}
                    {l.email && <span className="block">{l.email}</span>}
                  </td>
                  <td className="text-xs">
                    {LEAD_KIND_LABEL[l.kind]}
                    <span className="block text-muted">{LEAD_SOURCE_LABEL[l.source]}</span>
                  </td>
                  <td>{l.vehicleReference ?? "—"}</td>
                  <td>
                    <LeadStatusTag status={l.status} />
                  </td>
                  <td>{l.assignee ?? <span className="text-warn">Fila central</span>}</td>
                  <td className="text-xs">
                    {l.nextAction}
                    {l.nextActionAt && <span className={`block num ${new Date(l.nextActionAt) < new Date() ? "text-danger" : "text-muted"}`}>{formatShortDateTime(l.nextActionAt)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

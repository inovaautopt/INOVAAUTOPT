import Link from "next/link";
import { requireStaff, withStaff } from "@/server/auth";
import { PageHeader, StatCard, LeadStatusTag, Notice } from "@/components/admin/ui";
import { formatShortDateTime } from "@/lib/format";
import { LEAD_KIND_LABEL, type LeadKind, type LeadStatus } from "@/lib/domain";
import { getCrmSettings } from "@/lib/settings";

export default async function Dashboard(props: PageProps<"/admin">) {
  const s = await requireStaff();
  const sp = await props.searchParams;
  const crm = await getCrmSettings();
  const data = await withStaff(undefined, async (tx) => {
    const [v] = (await tx`select
        count(*) filter (where status = 'available')::int as available,
        count(*) filter (where status = 'reserved')::int as reserved,
        count(*) filter (where status = 'sold' and sold_at > now() - interval '30 days')::int as sold30,
        count(*) filter (where status = 'draft')::int as drafts
      from app.vehicles`) as unknown as [{ available: number; reserved: number; sold30: number; drafts: number }];
    const canLeads = s.profile.role !== "stock_manager";
    const leads = canLeads
      ? ((await tx`select
          count(*) filter (where status = 'new' and created_at > now() - interval '7 days')::int as fresh,
          count(*) filter (where assigned_to is null and status in ('new'))::int as unassigned,
          count(*) filter (where first_response_at is null and status in ('new', 'assigned') and created_at < now() - make_interval(mins => ${crm.unansweredAlertMinutes}))::int as unanswered
        from app.leads`) as unknown as [{ fresh: number; unassigned: number; unanswered: number }])[0]
      : null;
    const appts = canLeads ? ((await tx`select count(*)::int as n from app.appointments where status = 'requested'`) as unknown as [{ n: number }])[0]!.n : 0;
    const recent = canLeads
      ? ((await tx`select l.id, l.name, l.kind, l.status, l.created_at, l.vehicle_reference, p.full_name as assignee
          from app.leads l left join app.profiles p on p.id = l.assigned_to
          where l.status not in ('won', 'lost', 'archived') order by l.created_at desc limit 8`) as unknown as {
          id: string; name: string; kind: LeadKind; status: LeadStatus; createdAt: Date; vehicleReference: string | null; assignee: string | null;
        }[])
      : [];
    const failures = s.profile.role === "admin" ? ((await tx`select count(*)::int as n from app.notification_outbox where status in ('failed', 'dead')`) as unknown as [{ n: number }])[0]!.n : 0;
    return { v, leads, appts, recent, failures };
  });

  return (
    <>
      <PageHeader title={`Olá, ${s.profile.fullName.split(" ")[0]}`} description="Números internos do painel. A analítica do site (visitas) depende do consentimento dos visitantes e não aparece aqui." />
      {sp.erro === "sem-permissao" && (
        <div className="mb-4">
          <Notice tone="danger">Não tens permissão para abrir essa área.</Notice>
        </div>
      )}
      {data.failures > 0 && (
        <div className="mb-4">
          <Notice tone="warn">
            {data.failures} notificação(ões) falharam. <Link className="font-semibold underline" href="/admin/integracoes">Ver integrações</Link>
          </Notice>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Viaturas disponíveis" value={data.v.available} href="/admin/viaturas?estado=available" />
        <StatCard label="Reservadas" value={data.v.reserved} href="/admin/viaturas?estado=reserved" />
        <StatCard label="Vendidas (30 dias)" value={data.v.sold30} href="/admin/viaturas?estado=sold" />
        <StatCard label="Rascunhos" value={data.v.drafts} href="/admin/viaturas?estado=draft" />
        {data.leads && (
          <>
            <StatCard label="Contactos novos (7 dias)" value={data.leads.fresh} href="/admin/contactos?estado=new" />
            <StatCard label="Sem responsável" value={data.leads.unassigned} href="/admin/contactos?responsavel=nenhum" tone={data.leads.unassigned ? "warn" : undefined} />
            <StatCard label={`Sem resposta há +${crm.unansweredAlertMinutes} min`} value={data.leads.unanswered} href="/admin/contactos?sem_resposta=1" tone={data.leads.unanswered ? "danger" : undefined} />
            <StatCard label="Visitas por confirmar" value={data.appts} href="/admin/visitas" tone={data.appts ? "warn" : undefined} />
          </>
        )}
      </div>

      {data.recent.length > 0 && (
        <section className="mt-8">
          <h2 className="heading text-lg">Contactos em aberto</h2>
          <div className="panel mt-3 overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Recebido</th>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Viatura</th>
                  <th>Estado</th>
                  <th>Responsável</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((l) => (
                  <tr key={l.id}>
                    <td className="num whitespace-nowrap">{formatShortDateTime(l.createdAt)}</td>
                    <td>
                      <Link href={`/admin/contactos/${l.id}`} className="font-semibold hover:underline">
                        {l.name}
                      </Link>
                    </td>
                    <td>{LEAD_KIND_LABEL[l.kind]}</td>
                    <td>{l.vehicleReference ?? "—"}</td>
                    <td>
                      <LeadStatusTag status={l.status} />
                    </td>
                    <td>{l.assignee ?? <span className="text-warn">Fila central</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

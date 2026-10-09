import Link from "next/link";
import { requireStaff, withStaff } from "@/server/auth";
import { PageHeader, Empty } from "@/components/admin/ui";
import { formatDate, formatDateTime } from "@/lib/format";
import { APPOINTMENT_STATUS_LABEL, PERIOD_LABEL, type AppointmentStatus, type Period } from "@/lib/domain";

type Row = {
  id: string; leadId: string; kind: string; requestedDate: string; requestedPeriod: Period; status: AppointmentStatus; confirmedStart: Date | null; name: string; vehicleReference: string | null; staff: string | null;
};

function Table({ items }: { items: Row[] }) {
  return (
    <div className="panel overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Quando</th>
            <th>Cliente</th>
            <th>Tipo</th>
            <th>Viatura</th>
            <th>Estado</th>
            <th>Vendedor</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id}>
              <td className="num whitespace-nowrap">{a.confirmedStart ? formatDateTime(a.confirmedStart) : `${formatDate(a.requestedDate)} (${PERIOD_LABEL[a.requestedPeriod]})`}</td>
              <td>
                <Link href={`/admin/contactos/${a.leadId}`} className="font-semibold hover:underline">
                  {a.name}
                </Link>
              </td>
              <td>{a.kind === "test_drive" ? "Test drive" : "Visita"}</td>
              <td>{a.vehicleReference ?? "—"}</td>
              <td>{APPOINTMENT_STATUS_LABEL[a.status]}</td>
              <td>{a.staff ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function Appointments() {
  await requireStaff(["admin", "sales"]);
  const rows = await withStaff(undefined, async (tx) =>
    (await tx`select a.id, a.lead_id, a.kind, a.requested_date::text as requested_date, a.requested_period, a.status, a.confirmed_start,
        l.name, l.vehicle_reference, p.full_name as staff
      from app.appointments a join app.leads l on l.id = a.lead_id left join app.profiles p on p.id = a.staff_id
      where a.status in ('requested', 'confirmed') and (a.confirmed_start is null or a.confirmed_start > now() - interval '1 day')
      order by coalesce(a.confirmed_start, a.requested_date::timestamptz), a.created_at`) as unknown as {
      id: string; leadId: string; kind: string; requestedDate: string; requestedPeriod: Period; status: AppointmentStatus; confirmedStart: Date | null; name: string; vehicleReference: string | null; staff: string | null;
    }[],
  );
  const pending = rows.filter((r) => r.status === "requested");
  const confirmed = rows.filter((r) => r.status === "confirmed");
  return (
    <>
      <PageHeader title="Visitas e test drives" description="Pedidos do site ficam por confirmar até um vendedor escolher a hora. Horas em Europe/Lisbon." />
      <h2 className="heading mb-3 text-lg">Por confirmar ({pending.length})</h2>
      {pending.length ? <Table items={pending} /> : <Empty>Sem pedidos por confirmar.</Empty>}
      <h2 className="heading mb-3 mt-8 text-lg">Confirmadas ({confirmed.length})</h2>
      {confirmed.length ? <Table items={confirmed} /> : <Empty>Sem marcações confirmadas.</Empty>}
    </>
  );
}

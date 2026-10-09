/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { requireStaff, withStaff } from "@/server/auth";
import { PageHeader, VehicleStatusTag, Empty } from "@/components/admin/ui";
import { formatPrice, formatShortDateTime } from "@/lib/format";
import { mediaUrl } from "@/lib/storage-url";
import { VEHICLE_STATUSES, VEHICLE_STATUS_LABEL, type VehicleStatus } from "@/lib/domain";

export default async function AdminVehicles(props: PageProps<"/admin/viaturas">) {
  const s = await requireStaff();
  const sp = await props.searchParams;
  const estado = typeof sp.estado === "string" && (VEHICLE_STATUSES as readonly string[]).includes(sp.estado) ? (sp.estado as VehicleStatus) : null;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  const rows = await withStaff(undefined, async (tx) => {
    const like = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    return (await tx`
      select v.id, v.reference, v.make, v.model, v.version_name, v.price_cents, v.status, v.updated_at, v.is_demo, v.is_featured,
        (select m.storage_path from app.vehicle_media m where m.vehicle_id = v.id order by m.is_cover desc, m.position limit 1) as cover,
        (select count(*)::int from app.vehicle_media m where m.vehicle_id = v.id) as photos,
        (select count(*)::int from app.leads l where l.vehicle_id = v.id) as leads
      from app.vehicles v
      where ${estado ? tx`v.status = ${estado}` : tx`v.status <> 'archived'`}
        ${q ? tx`and (v.make ilike ${like} or v.model ilike ${like} or v.reference ilike ${like} or coalesce(v.version_name,'') ilike ${like})` : tx``}
      order by case v.status when 'available' then 0 when 'reserved' then 1 when 'draft' then 2 when 'sold' then 3 else 4 end, v.updated_at desc
      limit 200`) as unknown as {
      id: string; reference: string; make: string; model: string; versionName: string | null; priceCents: number | null; status: VehicleStatus;
      updatedAt: Date; isDemo: boolean; isFeatured: boolean; cover: string | null; photos: number; leads: number;
    }[];
  });
  const canEdit = s.profile.role !== "sales";
  return (
    <>
      <PageHeader
        title="Viaturas"
        actions={
          canEdit && (
            <Link href="/admin/viaturas/nova" className="btn btn-primary">
              Nova viatura
            </Link>
          )
        }
      />
      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <input name="q" defaultValue={q} placeholder="Marca, modelo ou referência" className="input max-w-xs" aria-label="Pesquisar" />
        <select name="estado" defaultValue={estado ?? ""} className="input max-w-[12rem]" aria-label="Estado">
          <option value="">Todas (sem arquivadas)</option>
          {VEHICLE_STATUSES.map((st) => (
            <option key={st} value={st}>
              {VEHICLE_STATUS_LABEL[st]}
            </option>
          ))}
        </select>
        <button className="btn btn-dark">Filtrar</button>
      </form>
      {rows.length === 0 ? (
        <Empty>Não há viaturas com estes critérios. {canEdit && <Link className="font-semibold underline" href="/admin/viaturas/nova">Criar a primeira</Link>}</Empty>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th></th>
                <th>Referência</th>
                <th>Viatura</th>
                <th>Preço</th>
                <th>Estado</th>
                <th>Fotos</th>
                <th>Contactos</th>
                <th>Atualizada</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id}>
                  <td className="w-20">{v.cover ? <img src={mediaUrl(v.cover, 480)} alt="" width={72} height={54} className="h-[54px] w-[72px] rounded object-cover" /> : <div className="h-[54px] w-[72px] rounded bg-chrome-hi" />}</td>
                  <td className="num font-semibold">{v.reference}</td>
                  <td>
                    <Link href={`/admin/viaturas/${v.id}`} className="font-semibold hover:underline">
                      {v.make} {v.model}
                    </Link>
                    <span className="block text-xs text-muted">{v.versionName}</span>
                    {v.isDemo && <span className="tag tag-dark mt-1">Demonstração</span>}
                    {v.isFeatured && <span className="tag tag-brand mt-1 ml-1">Destaque</span>}
                  </td>
                  <td className="num whitespace-nowrap">{v.priceCents ? formatPrice(v.priceCents) : <span className="text-warn">Sem preço</span>}</td>
                  <td>
                    <VehicleStatusTag status={v.status} />
                  </td>
                  <td className={v.photos === 0 ? "text-warn" : ""}>{v.photos}</td>
                  <td>{v.leads}</td>
                  <td className="num whitespace-nowrap text-muted">{formatShortDateTime(v.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

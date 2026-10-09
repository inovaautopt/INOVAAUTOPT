/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff, withStaff } from "@/server/auth";
import { loadVehicle } from "@/server/admin-vehicles";
import { PageHeader, VehicleStatusTag, Notice } from "@/components/admin/ui";
import { VehicleForm } from "@/components/admin/VehicleForm";
import { ActionForm } from "@/components/admin/ActionForm";
import { saveVehicleAction, duplicateVehicleAction, setStatusAction, reserveAction, closeReservationAction, uploadMediaAction, importMediaUrlsAction, mediaOpAction } from "../actions";
import { mediaUrl } from "@/lib/storage-url";
import { formatDateTime, formatPrice } from "@/lib/format";
import { VEHICLE_STATUS_LABEL, type FeatureGroup, type VehicleStatus } from "@/lib/domain";
import { Plate } from "@/components/vehicle/Plate";

export default async function EditVehicle(props: PageProps<"/admin/viaturas/[id]">) {
  const s = await requireStaff();
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const canEdit = s.profile.role !== "sales";
  const data = await withStaff(undefined, async (tx) => {
    const v = await loadVehicle(tx, id);
    if (!v) return null;
    const [priv] = canEdit ? ((await tx`select vin, plate, purchase_cost_cents, internal_notes from app.vehicle_private_details where vehicle_id = ${id}`) as unknown as { vin: string | null; plate: string | null; purchaseCostCents: number | null; internalNotes: string | null }[]) : [];
    const media = (await tx`select id, storage_path, alt_text, is_cover, position from app.vehicle_media where vehicle_id = ${id} order by position, created_at`) as unknown as { id: string; storagePath: string; altText: string | null; isCover: boolean }[];
    const featureIds = ((await tx`select feature_id from app.vehicle_features where vehicle_id = ${id}`) as unknown as { featureId: string }[]).map((r) => r.featureId);
    const features = (await tx`select id, name, feature_group as "group" from app.features order by feature_group, name`) as unknown as { id: string; name: string; group: FeatureGroup }[];
    const branches = (await tx`select id, name from app.branches where is_active order by name`) as unknown as { id: string; name: string }[];
    const reservation = ((await tx`select r.id, r.expires_at, r.note, r.created_at, l.name as lead_name, l.id as lead_id, p.full_name as created_by_name
      from app.vehicle_reservations r left join app.leads l on l.id = r.lead_id left join app.profiles p on p.id = r.created_by
      where r.vehicle_id = ${id} and r.status = 'active'`) as unknown as { id: string; expiresAt: Date; note: string | null; createdAt: Date; leadName: string | null; leadId: string | null; createdByName: string | null }[])[0];
    const prices = (await tx`select h.old_price_cents, h.new_price_cents, h.changed_at, p.full_name from app.vehicle_price_history h left join app.profiles p on p.id = h.changed_by where h.vehicle_id = ${id} order by h.changed_at desc limit 20`) as unknown as { oldPriceCents: number | null; newPriceCents: number | null; changedAt: Date; fullName: string | null }[];
    const statuses = (await tx`select h.old_status, h.new_status, h.changed_at, p.full_name from app.vehicle_status_history h left join app.profiles p on p.id = h.changed_by where h.vehicle_id = ${id} order by h.changed_at desc limit 20`) as unknown as { oldStatus: VehicleStatus | null; newStatus: VehicleStatus; changedAt: Date; fullName: string | null }[];
    const openLeads = s.profile.role === "stock_manager" ? [] : ((await tx`select id, name, vehicle_reference from app.leads
      where status not in ('won', 'lost', 'archived') order by (vehicle_id = ${id}) desc, created_at desc limit 50`) as unknown as { id: string; name: string; vehicleReference: string | null }[]);
    return { v, priv, media, featureIds, features, branches, reservation, prices, statuses, openLeads };
  });
  if (!data) notFound();
  const { v } = data;
  const publishable = v.priceCents && v.vatRegime !== "unknown" && v.firstRegistrationYear && v.mileageKm !== null && v.fuel && v.transmission;
  const missing = [
    !v.priceCents && "preço",
    v.vatRegime === "unknown" && "tratamento de IVA",
    !v.firstRegistrationYear && "ano",
    v.mileageKm === null && "quilómetros",
    !v.fuel && "combustível",
    !v.transmission && "caixa",
    data.media.length === 0 && "fotografias (recomendado)",
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        title={`${v.make} ${v.model}`}
        description={v.versionName ?? undefined}
        actions={
          <>
            {v.status !== "draft" && v.status !== "archived" && (
              <Link href={`/viaturas/${v.slug}`} target="_blank" className="btn btn-outline">
                Ver no site
              </Link>
            )}
            <Link href={`/admin/viaturas/${v.id}/pre-visualizar`} className="btn btn-outline">
              Pré-visualizar
            </Link>
            {canEdit && (
              <form action={duplicateVehicleAction}>
                <input type="hidden" name="id" value={v.id} />
                <button className="btn btn-outline">Duplicar</button>
              </form>
            )}
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Plate reference={v.reference} year={v.firstRegistrationYear} month={v.firstRegistrationMonth} />
        <VehicleStatusTag status={v.status} />
        {v.isDemo && <span className="tag tag-dark">Demonstração</span>}
        <span className="text-sm text-muted">Atualizada {formatDateTime(v.updatedAt)}</span>
      </div>
      {sp.criada && <div className="mb-4"><Notice tone="ok">Viatura criada como rascunho. Carrega as fotografias e publica quando estiver pronta.</Notice></div>}
      {sp.duplicada && <div className="mb-4"><Notice tone="ok">Cópia criada em rascunho com nova referência. Revê os dados e carrega fotografias.</Notice></div>}

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {canEdit ? (
            <VehicleForm
              action={saveVehicleAction}
              values={{
                ...v,
                priceEuros: v.priceCents !== null ? v.priceCents / 100 : null,
                historyFacts: v.historyFacts as { key: string; value: string; source: string; verified_on: string }[],
                featureIds: data.featureIds,
                vin: data.priv?.vin,
                plate: data.priv?.plate,
                purchaseCostEuros: data.priv?.purchaseCostCents != null ? data.priv.purchaseCostCents / 100 : null,
                internalNotes: data.priv?.internalNotes,
              }}
              branches={data.branches}
              features={data.features}
              canSeePrivate
            />
          ) : (
            <Notice>Como vendedor podes consultar a viatura e gerir reservas, mas não alterar preços nem dados.</Notice>
          )}
        </div>

        <aside className="space-y-6">
          {canEdit && (
            <section className="panel space-y-3 p-4">
              <h2 className="heading text-base">Publicação</h2>
              {missing.length > 0 && <p className="text-sm text-warn">Falta: {missing.join(", ")}.</p>}
              <div className="flex flex-wrap gap-2">
                {(v.status === "draft" || v.status === "archived") && (
                  <StatusButton id={v.id} version={v.version} status="available" label="Publicar" disabled={!publishable} />
                )}
                {v.status === "available" && <StatusButton id={v.id} version={v.version} status="draft" label="Retirar do site" />}
                {(v.status === "available" || v.status === "reserved") && <StatusButton id={v.id} version={v.version} status="sold" label="Marcar vendida" confirm="Marcar esta viatura como vendida? Sai do stock disponível." />}
                {v.status !== "archived" && <StatusButton id={v.id} version={v.version} status="archived" label="Arquivar" confirm="Arquivar esta viatura? Deixa de aparecer no site." />}
              </div>
            </section>
          )}

          <section className="panel space-y-3 p-4">
            <h2 className="heading text-base">Reserva comercial</h2>
            <p className="text-xs text-muted">Sem pagamento. Uma reserva tira a viatura de «Disponível» até expirar, ser cancelada ou convertida em venda.</p>
            {data.reservation ? (
              <>
                <p className="text-sm">
                  Reservada até <strong>{formatDateTime(data.reservation.expiresAt)}</strong>
                  {data.reservation.leadName && (
                    <>
                      {" "}para <Link className="underline" href={`/admin/contactos/${data.reservation.leadId}`}>{data.reservation.leadName}</Link>
                    </>
                  )}
                  {data.reservation.createdByName && <> · por {data.reservation.createdByName}</>}
                </p>
                {data.reservation.note && <p className="text-sm text-muted">{data.reservation.note}</p>}
                <ActionForm action={closeReservationAction} submitLabel="Converter em venda" submitClassName="btn-dark btn-sm" confirm="Confirmas a venda desta viatura?">
                  <input type="hidden" name="reservationId" value={data.reservation.id} />
                  <input type="hidden" name="outcome" value="converted" />
                </ActionForm>
                <ActionForm action={closeReservationAction} submitLabel="Cancelar reserva" submitClassName="btn-outline btn-sm">
                  <input type="hidden" name="reservationId" value={data.reservation.id} />
                  <input type="hidden" name="outcome" value="cancelled" />
                  <input name="reason" className="input" placeholder="Motivo (opcional)" aria-label="Motivo do cancelamento" />
                </ActionForm>
              </>
            ) : v.status === "available" ? (
              <ActionForm action={reserveAction} submitLabel="Reservar" submitClassName="btn-dark btn-sm">
                <input type="hidden" name="id" value={v.id} />
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-sm">
                    Dias
                    <input name="days" type="number" min={1} max={30} defaultValue={3} className="input mt-1" />
                  </label>
                  <label className="text-sm">
                    Contacto (opcional)
                    <select name="leadId" className="input mt-1">
                      <option value="">—</option>
                      {data.openLeads.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}{l.vehicleReference ? ` (${l.vehicleReference})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <input name="note" className="input" placeholder="Nota (opcional)" aria-label="Nota" />
              </ActionForm>
            ) : (
              <p className="text-sm text-muted">Só viaturas disponíveis podem ser reservadas (estado atual: {VEHICLE_STATUS_LABEL[v.status]}).</p>
            )}
          </section>

          <section className="panel p-4">
            <h2 className="heading text-base">Histórico de preço</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {data.prices.map((p, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="num">
                    {p.oldPriceCents ? `${formatPrice(p.oldPriceCents)} → ` : ""}
                    {formatPrice(p.newPriceCents)}
                  </span>
                  <span className="text-xs text-muted">{formatDateTime(p.changedAt)}{p.fullName ? ` · ${p.fullName}` : ""}</span>
                </li>
              ))}
              {data.prices.length === 0 && <li className="text-muted">Sem alterações.</li>}
            </ul>
            <h2 className="heading mt-4 text-base">Histórico de estado</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {data.statuses.map((p, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>{p.oldStatus ? `${VEHICLE_STATUS_LABEL[p.oldStatus]} → ` : ""}{VEHICLE_STATUS_LABEL[p.newStatus]}</span>
                  <span className="text-xs text-muted">{formatDateTime(p.changedAt)}{p.fullName ? ` · ${p.fullName}` : ""}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      <section className="mt-8">
        <h2 className="heading text-xl">Fotografias ({data.media.length})</h2>
        <p className="text-sm text-muted">A primeira é a capa. As fotografias são convertidas para WebP e os metadados (incluindo localização GPS) são removidos.</p>
        {canEdit && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="panel p-4">
              <ActionForm action={uploadMediaAction} submitLabel="Carregar fotografias" pendingLabel="A processar…" resetOnSuccess>
                <input type="hidden" name="vehicleId" value={v.id} />
                <label className="field-label" htmlFor="photos">Do computador ou telemóvel</label>
                <input id="photos" name="photos" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple className="block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-ink file:px-3 file:py-2 file:font-semibold file:text-white" />
              </ActionForm>
            </div>
            <div className="panel p-4">
              <ActionForm action={importMediaUrlsAction} submitLabel="Importar por URL" pendingLabel="A descarregar…" resetOnSuccess>
                <input type="hidden" name="vehicleId" value={v.id} />
                <label className="field-label" htmlFor="urls">URLs de fotografias próprias (um por linha)</label>
                <textarea id="urls" name="urls" className="input min-h-20 font-mono text-xs" placeholder="https://..." />
                <p className="field-hint">Só domínios autorizados (por omissão, as publicações do Instagram da empresa).</p>
              </ActionForm>
            </div>
          </div>
        )}
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.media.map((m, i) => (
            <li key={m.id} className="panel overflow-hidden">
              <img src={mediaUrl(m.storagePath, 480)} alt={m.altText ?? ""} width={480} height={360} className="aspect-[4/3] w-full object-cover" />
              <div className="space-y-2 p-3">
                <p className="text-xs font-semibold">{m.isCover ? <span className="tag tag-brand">Capa</span> : `#${i + 1}`}</p>
                {canEdit && (
                  <>
                    <form action={mediaOpAction} className="flex gap-1">
                      <input type="hidden" name="vehicleId" value={v.id} />
                      <input type="hidden" name="mediaId" value={m.id} />
                      <input type="hidden" name="op" value="alt" />
                      <input name="alt" defaultValue={m.altText ?? ""} placeholder="Texto alternativo" aria-label="Texto alternativo" className="input min-h-9 py-1 text-sm" />
                      <button className="btn btn-outline btn-sm">OK</button>
                    </form>
                    <div className="flex flex-wrap gap-1">
                      {(["up", "down", "cover", "delete"] as const).map((op) =>
                        (op === "up" && i === 0) || (op === "down" && i === data.media.length - 1) || (op === "cover" && m.isCover) ? null : (
                          <form key={op} action={mediaOpAction}>
                            <input type="hidden" name="vehicleId" value={v.id} />
                            <input type="hidden" name="mediaId" value={m.id} />
                            <input type="hidden" name="op" value={op} />
                            <button className={`btn btn-sm ${op === "delete" ? "btn-ghost text-danger" : "btn-outline"}`}>{{ up: "↑ Antes", down: "↓ Depois", cover: "Usar como capa", delete: "Apagar" }[op]}</button>
                          </form>
                        ),
                      )}
                    </div>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function StatusButton({ id, version, status, label, disabled, confirm }: { id: string; version: number; status: VehicleStatus; label: string; disabled?: boolean; confirm?: string }) {
  if (disabled) return <button className="btn btn-primary btn-sm" disabled title="Preenche os campos em falta">{label}</button>;
  return (
    <ActionForm action={setStatusAction} submitLabel={label} submitClassName={status === "available" ? "btn-sm" : "btn-outline btn-sm"} confirm={confirm} className="space-y-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="status" value={status} />
    </ActionForm>
  );
}

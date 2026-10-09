import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff, withStaff } from "@/server/auth";
import { loadVehicle } from "@/server/admin-vehicles";
import { Gallery } from "@/components/vehicle/Gallery";
import { Plate } from "@/components/vehicle/Plate";
import { formatKm, formatPrice, formatRegistration } from "@/lib/format";
import { FUEL_LABEL, TRANSMISSION_LABEL, VAT_LABEL, type Fuel, type Transmission, type VatRegime } from "@/lib/domain";

/** Pré-visualização interna (também para rascunhos), sem indexação. */
export default async function Preview(props: PageProps<"/admin/viaturas/[id]/pre-visualizar">) {
  await requireStaff();
  const { id } = await props.params;
  const data = await withStaff(undefined, async (tx) => {
    const v = await loadVehicle(tx, id);
    if (!v) return null;
    const media = (await tx`select id, storage_path, alt_text from app.vehicle_media where vehicle_id = ${id} and kind = 'image' order by is_cover desc, position`) as unknown as { id: string; storagePath: string; altText: string | null }[];
    return { v, media };
  });
  if (!data) notFound();
  const { v } = data;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="tag tag-warn">Pré-visualização — {v.status === "draft" ? "rascunho, não publicado" : "como aparece no site"}</p>
        <Link href={`/admin/viaturas/${id}`} className="btn btn-outline btn-sm">
          Voltar à edição
        </Link>
      </div>
      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <Gallery items={data.media} title={`${v.make} ${v.model}`} />
        <div>
          <Plate reference={v.reference} year={v.firstRegistrationYear} month={v.firstRegistrationMonth} />
          <h1 className="display mt-3 text-4xl">
            {v.make} {v.model}
          </h1>
          <p className="text-lg text-ink-soft">{v.versionName}</p>
          <p className="heading mt-4 text-4xl num">{formatPrice(v.priceCents)}</p>
          <p className="text-sm text-muted">{VAT_LABEL[v.vatRegime as VatRegime]}</p>
          <ul className="mt-4 space-y-1 text-sm">
            <li>{formatRegistration(v.firstRegistrationYear, v.firstRegistrationMonth)}</li>
            <li>{formatKm(v.mileageKm)}</li>
            <li>{v.fuel ? FUEL_LABEL[v.fuel as Fuel] : "—"} · {v.transmission ? TRANSMISSION_LABEL[v.transmission as Transmission] : "—"}</li>
          </ul>
          {v.description && <p className="mt-4 whitespace-pre-line text-sm">{v.description}</p>}
        </div>
      </div>
    </div>
  );
}

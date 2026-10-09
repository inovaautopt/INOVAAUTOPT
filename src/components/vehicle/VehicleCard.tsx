import Link from "next/link";
import type { VehicleCard as Card } from "@/lib/vehicles";
import { FUEL_LABEL, TRANSMISSION_LABEL } from "@/lib/domain";
import { formatKm, formatPrice } from "@/lib/format";
import { VehicleImage } from "./VehicleImage";
import { Plate } from "./Plate";
import { FavoriteButton } from "./ListButtons";

export function vehicleTitle(v: { make: string; model: string }) {
  return `${v.make} ${v.model}`;
}

export function VehicleCard({ v, priority = false }: { v: Card; priority?: boolean }) {
  const title = vehicleTitle(v);
  const specs = [
    v.mileageKm !== null ? formatKm(v.mileageKm) : null,
    v.fuel ? FUEL_LABEL[v.fuel] : null,
    v.transmission ? TRANSMISSION_LABEL[v.transmission] : null,
    v.powerHp ? `${v.powerHp} cv` : null,
  ].filter(Boolean) as string[];
  const reduced = v.previousPriceCents !== null && v.priceCents !== null && v.previousPriceCents > v.priceCents;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface">
      <div className="relative">
        <VehicleImage
          path={v.coverPath}
          alt={v.coverAlt ?? `${title}${v.versionName ? ` ${v.versionName}` : ""}`}
          sizes="(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw"
          priority={priority}
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {v.status === "reserved" && <span className="tag tag-warn">Reservado</span>}
          {reduced && <span className="tag tag-brand">Preço reduzido</span>}
          {v.isDemo && <span className="tag tag-dark">Demonstração</span>}
        </div>
        <FavoriteButton id={v.id} label={title} className="absolute right-3 top-3 z-10 shadow-[var(--shadow-pop)]" />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="heading text-lg leading-tight">
            <Link href={`/viaturas/${v.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
              {title}
            </Link>
          </h3>
          <p className="mt-0.5 line-clamp-1 text-sm text-muted">{v.versionName ?? " "}</p>
        </div>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-soft" aria-label="Características">
          {specs.map((s) => (
            <li key={s} className="num">
              {s}
            </li>
          ))}
        </ul>
        <div className="mt-auto flex items-end justify-between gap-3 pt-1">
          <Plate reference={v.reference} year={v.firstRegistrationYear} month={v.firstRegistrationMonth} size="sm" />
          <p className="text-right">
            {reduced && <span className="block text-xs text-muted line-through num">{formatPrice(v.previousPriceCents)}</span>}
            <span className="heading text-xl num">{formatPrice(v.priceCents)}</span>
          </p>
        </div>
      </div>
    </article>
  );
}

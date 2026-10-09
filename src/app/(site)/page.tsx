import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, MapPin, Phone } from "lucide-react";
import { InstagramIcon } from "@/components/brand/InstagramIcon";
import { getFeaturedVehicles, getMakeModelMap, getStockCounts } from "@/lib/vehicles";
import { getPublicSettings } from "@/lib/settings";
import { getBranches, directionsUrl, summarizeHours } from "@/lib/branches";
import { BODY_TYPE_LABEL, FUEL_LABEL, SERVICES, SERVICE_LABEL } from "@/lib/domain";
import { VehicleCard } from "@/components/vehicle/VehicleCard";
import { QuickSearch } from "@/components/site/QuickSearch";
import { VehicleImage } from "@/components/vehicle/VehicleImage";
import { formatPrice, socialHandle } from "@/lib/format";
import { callCostNote, formatPhone } from "@/lib/phone";
import { WhatsAppLink } from "@/components/vehicle/WhatsAppLink";
import { JsonLd, dealerJsonLd } from "@/components/site/JsonLd";

export async function generateMetadata(): Promise<Metadata> {
  const { company } = await getPublicSettings();
  return {
    title: { absolute: `${company.tradeName} — viaturas disponíveis` },
    description: company.valueProposition ?? `Viaturas disponíveis no stand ${company.tradeName}. Fotografias, preços, comparador e marcação de visitas.`,
    alternates: { canonical: "/" },
  };
}

export default async function HomePage() {
  const [settings, featured, counts, makes, branches] = await Promise.all([getPublicSettings(), getFeaturedVehicles(6), getStockCounts(), getMakeModelMap(), getBranches()]);
  const { company, services } = settings;
  const hero = featured[0];
  const activeServices = SERVICES.filter((s) => services[s]);
  const branch = branches[0];

  return (
    <>
      <JsonLd data={dealerJsonLd(company, branches)} />
      {/* Primeiro ecrã: proposta de valor, pesquisa e acesso ao stock */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto grid max-w-[90rem] gap-8 px-4 pb-10 pt-8 md:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-12 lg:pb-14 lg:pt-12">
          <div className="animate-rise">
            <h1 className="display text-[2.4rem] leading-[1.02] xs:text-[2.75rem] md:text-5xl lg:text-[4.25rem]">{company.valueProposition ?? "Encontra a tua próxima viatura."}</h1>
            <p className="mt-4 max-w-[46ch] text-lg text-ink-soft">
              {counts.available > 0 ? (
                <>
                  <strong className="num">{counts.available}</strong> {counts.available === 1 ? "viatura disponível" : "viaturas disponíveis"} no stand {company.tradeName}. Vê as fotografias, compara e marca a tua visita.
                </>
              ) : (
                <>O stock está a ser atualizado. Deixa-nos o teu contacto e dizemos-te quando chegar a viatura que procuras.</>
              )}
            </p>
            <div className="mt-6">
              <QuickSearch makes={makes} total={counts.available} />
            </div>
            <p className="mt-4">
              <Link href="/viaturas" className="inline-flex items-center gap-1.5 font-semibold text-brand-ink underline-offset-4 hover:underline">
                Ver todo o stock <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            </p>
          </div>

          {hero && (
            <Link href={`/viaturas/${hero.slug}`} className="group relative block overflow-hidden rounded-[var(--radius-lg)] bg-ink">
              <VehicleImage path={hero.coverPath} alt={hero.coverAlt ?? `${hero.make} ${hero.model}`} sizes="(min-width: 1024px) 45vw, 100vw" priority className="opacity-95 transition-opacity group-hover:opacity-100" />
              <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 bg-gradient-to-t from-ink/90 via-ink/50 to-transparent p-4 pt-16 text-white md:p-5">
                <div>
                  <p className="heading text-xl md:text-2xl">
                    {hero.make} {hero.model}
                  </p>
                  {hero.versionName && <p className="text-sm text-chrome">{hero.versionName}</p>}
                </div>
                <p className="heading text-2xl num">{formatPrice(hero.priceCents)}</p>
              </div>
              {hero.isDemo && <span className="tag tag-dark absolute left-3 top-3">Demonstração</span>}
            </Link>
          )}
        </div>
      </section>

      {featured.length > 1 && (
        <section className="mx-auto max-w-[90rem] px-4 pt-12 md:px-6" aria-labelledby="destaques">
          <div className="flex items-end justify-between gap-4">
            <h2 id="destaques" className="heading text-2xl md:text-3xl">
              No stand agora
            </h2>
            <Link href="/viaturas" className="hidden font-semibold text-brand-ink hover:underline sm:inline">
              Ver todas
            </Link>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.slice(1).map((v) => (
              <VehicleCard key={v.id} v={v} />
            ))}
          </div>
        </section>
      )}

      {(counts.bodyTypes.length > 1 || counts.fuels.length > 1) && (
        <section className="mx-auto max-w-[90rem] px-4 pt-14 md:px-6" aria-labelledby="categorias">
          <h2 id="categorias" className="heading text-2xl md:text-3xl">
            Procurar por tipo
          </h2>
          <ul className="mt-5 flex flex-wrap gap-2">
            {counts.bodyTypes.map((b) => (
              <li key={b.bodyType}>
                <Link href={`/viaturas?carrocaria=${b.bodyType}`} className="btn btn-outline">
                  {BODY_TYPE_LABEL[b.bodyType]} <span className="text-muted num">{b.count}</span>
                </Link>
              </li>
            ))}
            {counts.fuels.map((f) => (
              <li key={f.fuel}>
                <Link href={`/viaturas?combustivel=${f.fuel}`} className="btn btn-outline">
                  {FUEL_LABEL[f.fuel]} <span className="text-muted num">{f.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {activeServices.length > 0 && (
        <section className="mx-auto max-w-[90rem] px-4 pt-14 md:px-6" aria-labelledby="servicos">
          <h2 id="servicos" className="heading text-2xl md:text-3xl">
            Serviços do stand
          </h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {activeServices.map((s) => (
              <li key={s}>
                <Link
                  href={s === "trade_in" ? "/retomas" : s === "financing" ? "/financiamento" : `/servicos#${s}`}
                  className="flex h-full items-center justify-between gap-3 rounded-[var(--radius-md)] border border-line bg-surface p-4 font-semibold hover:border-ink"
                >
                  {SERVICE_LABEL[s]}
                  <ArrowRight aria-hidden className="h-4 w-4 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {company.instagramUrl && (
        <section className="mx-auto max-w-[90rem] px-4 pt-14 md:px-6" aria-labelledby="instagram">
          <div className="flex flex-col items-start justify-between gap-5 rounded-[var(--radius-lg)] border border-line bg-surface p-6 md:flex-row md:items-center md:p-8">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-brand-soft text-brand-ink">
                <InstagramIcon className="h-6 w-6" />
              </span>
              <div>
                <h2 id="instagram" className="heading text-xl md:text-2xl">
                  Segue o stand no Instagram
                </h2>
                <p className="mt-1 text-ink-soft">As viaturas que chegam aparecem primeiro em {socialHandle(company.instagramUrl)}, com fotografias e vídeos.</p>
              </div>
            </div>
            <a href={company.instagramUrl} target="_blank" rel="noopener noreferrer" className="btn btn-dark w-full sm:w-auto">
              <InstagramIcon className="h-4 w-4" />
              Seguir {socialHandle(company.instagramUrl)}
            </a>
          </div>
        </section>
      )}

      {branch && (
        <section className="mx-auto max-w-[90rem] px-4 pt-14 md:px-6" aria-labelledby="visita">
          <div className="grid gap-6 rounded-[var(--radius-lg)] bg-ink p-6 text-chrome md:grid-cols-2 md:p-10">
            <div>
              <h2 id="visita" className="display text-3xl text-white md:text-4xl">
                Vem ver de perto.
              </h2>
              {branch.addressLine && (
                <p className="mt-4 flex gap-2">
                  <MapPin aria-hidden className="mt-0.5 h-5 w-5 flex-none" />
                  <span>
                    {branch.addressLine}, {[branch.postalCode, branch.city].filter(Boolean).join(" ")}
                  </span>
                </p>
              )}
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {summarizeHours(branch.openingHours).map((r) => (
                  <div key={r.days} className="contents">
                    <dt className="font-semibold text-white">{r.days}</dt>
                    <dd className="num">{r.hours}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="flex flex-col justify-end gap-3 md:items-end">
              {company.phoneE164 && (
                <a href={`tel:${company.phoneE164}`} className="btn btn-outline w-full border-white/30 bg-transparent text-white hover:border-white md:w-auto">
                  <Phone aria-hidden className="h-4 w-4" /> {formatPhone(company.phoneE164)}
                </a>
              )}
              {company.phoneE164 && callCostNote(company.phoneE164) && <p className="text-xs">{callCostNote(company.phoneE164)}</p>}
              {company.whatsappE164 && <WhatsAppLink phone={company.whatsappE164} message="Olá, gostaria de saber mais sobre as viaturas disponíveis." className="w-full md:w-auto" />}
              {directionsUrl(branch) && (
                <a href={directionsUrl(branch)!} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-full md:w-auto">
                  <MapPin aria-hidden className="h-4 w-4" /> Obter direções
                </a>
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

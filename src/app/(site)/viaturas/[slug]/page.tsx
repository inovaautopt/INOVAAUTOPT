import Link from "next/link";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ChevronLeft, MapPin, Info } from "lucide-react";
import { getSimilarVehicles, getVehicleBySlug } from "@/lib/vehicles";
import { getPublicSettings } from "@/lib/settings";
import { getBranches, directionsUrl } from "@/lib/branches";
import { getFaqs } from "@/lib/content";
import { siteUrl } from "@/lib/env";
import {
  BODY_TYPE_LABEL,
  DRIVETRAIN_LABEL,
  FEATURE_GROUPS,
  FEATURE_GROUP_LABEL,
  FUEL_LABEL,
  HISTORY_FACT_LABEL,
  NOT_STATED,
  ORIGIN_LABEL,
  TRANSMISSION_LABEL,
  VAT_LABEL,
} from "@/lib/domain";
import { formatDate, formatKm, formatNumber, formatPrice, formatRegistration } from "@/lib/format";
import { callCostNote } from "@/lib/phone";
import { vehicleContactMessage } from "@/lib/whatsapp-link";
import { mediaUrl } from "@/lib/storage-url";
import { Gallery } from "@/components/vehicle/Gallery";
import { Plate } from "@/components/vehicle/Plate";
import { ContactPanel, MobileContactBar } from "@/components/vehicle/ContactPanel";
import { VehicleCard } from "@/components/vehicle/VehicleCard";
import { CompareButton, FavoriteButton } from "@/components/vehicle/ListButtons";
import { ShareButton } from "@/components/vehicle/ShareButton";
import { VideoEmbed } from "@/components/vehicle/VideoEmbed";
import { JsonLd, vehicleJsonLd } from "@/components/site/JsonLd";

export async function generateMetadata(props: PageProps<"/viaturas/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const { vehicle: v } = await getVehicleBySlug(slug);
  if (!v) return { title: "Viatura não encontrada", robots: { index: false } };
  const title = `${v.make} ${v.model}${v.versionName ? ` ${v.versionName}` : ""}`;
  const parts = [formatRegistration(v.firstRegistrationYear, v.firstRegistrationMonth), v.mileageKm !== null ? formatKm(v.mileageKm) : null, v.fuel ? FUEL_LABEL[v.fuel] : null, formatPrice(v.priceCents)].filter(Boolean);
  const cover = v.media.find((m) => m.kind === "image");
  return {
    title: v.status === "sold" ? `${title} (vendido)` : title,
    description: `${title}: ${parts.join(", ")}. Referência ${v.reference}.`,
    alternates: { canonical: `/viaturas/${v.slug}` },
    // Viaturas vendidas continuam acessíveis (ligações partilhadas), mas não são indexadas
    robots: v.status === "sold" || v.isDemo ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description: parts.join(" · "),
      url: `/viaturas/${v.slug}`,
      ...(cover ? { images: [{ url: mediaUrl(cover.storagePath, 1600), width: 1600, height: 1200, alt: title }] } : {}),
    },
  };
}

function Spec({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="border-b border-line py-2.5">
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold num">{value ?? NOT_STATED}</dd>
    </div>
  );
}

export default async function VehiclePage(props: PageProps<"/viaturas/[slug]">) {
  const { slug } = await props.params;
  const { vehicle: v, redirectTo } = await getVehicleBySlug(slug);
  if (!v) {
    if (redirectTo) permanentRedirect(`/viaturas/${redirectTo}`);
    notFound();
  }
  const [settings, branches, similar, faqs] = await Promise.all([getPublicSettings(), getBranches(), getSimilarVehicles(v), getFaqs("vehicle")]);
  const { company, services, legal } = settings;
  const title = `${v.make} ${v.model}`;
  const url = siteUrl(`/viaturas/${v.slug}`);
  const message = vehicleContactMessage(v, url);
  const branch = branches.find((b) => b.id === v.branchId) ?? branches[0];
  const sold = v.status === "sold";
  const images = v.media.filter((m) => m.kind === "image");
  const reduced = v.previousPriceCents !== null && v.priceCents !== null && v.previousPriceCents > v.priceCents;
  const isEv = v.fuel === "electric" || v.fuel === "plugin_hybrid";
  const featuresByGroup = FEATURE_GROUPS.map((g) => ({ g, items: v.features.filter((f) => f.group === g) })).filter((x) => x.items.length > 0);

  return (
    <div className="mx-auto max-w-[90rem] px-4 pb-28 pt-4 md:px-6 lg:pb-10">
      <JsonLd data={sold ? null : vehicleJsonLd(v, url, company)} />
      <nav aria-label="Caminho" className="text-sm">
        <Link href="/viaturas" className="inline-flex items-center gap-1 font-semibold text-ink-soft hover:text-ink">
          <ChevronLeft aria-hidden className="h-4 w-4" /> Voltar às viaturas
        </Link>
      </nav>

      {sold && (
        <div role="status" className="mt-4 flex gap-3 rounded-[var(--radius-md)] border border-ink bg-ink p-4 text-white">
          <Info aria-hidden className="mt-0.5 h-5 w-5 flex-none" />
          <div>
            <p className="font-bold">Esta viatura já foi vendida{v.soldAt ? ` em ${formatDate(v.soldAt)}` : ""}.</p>
            <p className="text-sm text-chrome">
              Mantemos esta página para quem tinha a ligação.{" "}
              <Link href="/viaturas" className="font-semibold text-white underline">
                Ver viaturas disponíveis
              </Link>
            </p>
          </div>
        </div>
      )}
      {v.isDemo && (
        <p className="mt-4 rounded-[var(--radius-sm)] bg-plate-yellow px-3 py-2 text-sm font-semibold">Viatura de demonstração — dados fictícios usados apenas em testes.</p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(22rem,1fr)]">
        <div className="min-w-0 space-y-10">
          <Gallery items={images} title={title} />

          {/* Cabeçalho visível no telemóvel logo após a galeria */}
          <header className="lg:hidden">
            <VehicleHeading v={v} reduced={reduced} sold={sold} />
          </header>

          <section aria-labelledby="caracteristicas">
            <h2 id="caracteristicas" className="heading text-2xl">
              Características
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 md:grid-cols-3">
              <Spec label="Primeira matrícula" value={formatRegistration(v.firstRegistrationYear, v.firstRegistrationMonth)} />
              <Spec label="Quilómetros" value={formatKm(v.mileageKm)} />
              <Spec label="Combustível" value={v.fuel ? FUEL_LABEL[v.fuel] : null} />
              <Spec label="Caixa de velocidades" value={v.transmission ? TRANSMISSION_LABEL[v.transmission] : null} />
              <Spec label="Potência" value={v.powerHp ? `${v.powerHp} cv` : null} />
              <Spec label="Cilindrada" value={v.engineCc ? formatNumber(v.engineCc, " cm³") : null} />
              <Spec label="Carroçaria" value={v.bodyType ? BODY_TYPE_LABEL[v.bodyType] : null} />
              <Spec label="Portas" value={v.doors ? String(v.doors) : null} />
              <Spec label="Lugares" value={v.seats ? String(v.seats) : null} />
              <Spec label="Tração" value={v.drivetrain ? DRIVETRAIN_LABEL[v.drivetrain] : null} />
              <Spec label="Cor" value={v.color} />
              <Spec label="Origem" value={v.origin ? ORIGIN_LABEL[v.origin] : null} />
            </dl>
          </section>

          {isEv && (v.evRangeKm || v.evBatteryKwh || v.evBatterySohPercent || v.evCharging) && (
            <section aria-labelledby="eletrico">
              <h2 id="eletrico" className="heading text-2xl">
                Bateria e autonomia
              </h2>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 md:grid-cols-3">
                {v.evRangeKm && <Spec label={`Autonomia declarada${v.evRangeStandard ? ` (${v.evRangeStandard})` : ""}`} value={formatNumber(v.evRangeKm, " km")} />}
                {v.evBatteryKwh && <Spec label="Capacidade da bateria" value={`${String(v.evBatteryKwh).replace(".", ",")} kWh`} />}
                {v.evBatterySohPercent && <Spec label="Estado de saúde da bateria" value={`${String(v.evBatterySohPercent).replace(".", ",")}%`} />}
                {v.evCharging && <Spec label="Carregamento" value={v.evCharging} />}
              </dl>
              {v.evDataSource && (
                <p className="mt-2 text-xs text-muted">
                  Fonte: {v.evDataSource}
                  {v.evDataDate ? `, ${formatDate(v.evDataDate)}` : ""}.
                </p>
              )}
            </section>
          )}

          {v.description && (
            <section aria-labelledby="descricao">
              <h2 id="descricao" className="heading text-2xl">
                Descrição
              </h2>
              <div className="prose-inova mt-3 whitespace-pre-line text-ink-soft">{v.description}</div>
            </section>
          )}

          {featuresByGroup.length > 0 && (
            <section aria-labelledby="equipamento">
              <h2 id="equipamento" className="heading text-2xl">
                Equipamento
              </h2>
              <div className="mt-3 grid gap-6 sm:grid-cols-2">
                {featuresByGroup.map(({ g, items }) => (
                  <div key={g}>
                    <h3 className="font-bold">{FEATURE_GROUP_LABEL[g]}</h3>
                    <ul className="mt-2 space-y-1 text-sm text-ink-soft">
                      {items.map((f) => (
                        <li key={f.name} className="flex gap-2">
                          <span aria-hidden className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-brand" />
                          {f.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {v.historyFacts.length > 0 && (
            <section aria-labelledby="historico">
              <h2 id="historico" className="heading text-2xl">
                Histórico verificado
              </h2>
              <ul className="mt-3 divide-y divide-line rounded-[var(--radius-md)] border border-line bg-surface">
                {v.historyFacts.map((h) => (
                  <li key={h.key} className="p-3">
                    <p className="font-semibold">
                      {HISTORY_FACT_LABEL[h.key]}: {h.value}
                    </p>
                    <p className="text-xs text-muted">
                      Fonte: {h.source}. Verificado em {formatDate(h.verified_on)}.
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {v.warrantyText && (
            <section aria-labelledby="garantia">
              <h2 id="garantia" className="heading text-2xl">
                Garantia
              </h2>
              <p className="mt-3 whitespace-pre-line text-ink-soft">{v.warrantyText}</p>
            </section>
          )}

          {v.videoUrl && (
            <section aria-labelledby="video">
              <h2 id="video" className="heading text-2xl">
                Vídeo
              </h2>
              <div className="mt-3">
                <VideoEmbed url={v.videoUrl} title={title} consentVersion={legal.consentVersion} />
              </div>
            </section>
          )}

          {branch && (
            <section aria-labelledby="localizacao">
              <h2 id="localizacao" className="heading text-2xl">
                Onde está
              </h2>
              <p className="mt-3 flex gap-2">
                <MapPin aria-hidden className="mt-0.5 h-5 w-5 flex-none text-muted" />
                <span>
                  <strong>{branch.name}</strong>
                  {branch.addressLine && (
                    <>
                      <br />
                      {branch.addressLine}, {[branch.postalCode, branch.city].filter(Boolean).join(" ")}
                    </>
                  )}
                </span>
              </p>
              {directionsUrl(branch) && (
                <a href={directionsUrl(branch)!} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm mt-3">
                  Obter direções
                </a>
              )}
            </section>
          )}

          {faqs.length > 0 && (
            <section aria-labelledby="faq">
              <h2 id="faq" className="heading text-2xl">
                Perguntas frequentes
              </h2>
              <div className="mt-3 divide-y divide-line rounded-[var(--radius-md)] border border-line bg-surface">
                {faqs.map((f) => (
                  <details key={f.id} className="group p-4">
                    <summary className="cursor-pointer list-none font-semibold marker:hidden">{f.question}</summary>
                    <p className="mt-2 whitespace-pre-line text-sm text-ink-soft">{f.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="min-w-0 space-y-5 lg:sticky lg:top-20 lg:self-start">
          <header className="hidden lg:block">
            <VehicleHeading v={v} reduced={reduced} sold={sold} />
          </header>
          <div className="flex flex-wrap gap-2">
            <FavoriteButton id={v.id} label={title} withText />
            <CompareButton id={v.id} label={title} />
            <ShareButton url={url} title={title} />
          </div>
          <ContactPanel
            vehicle={{ id: v.id, reference: v.reference, title }}
            sold={sold}
            phone={company.phoneE164}
            phoneNote={callCostNote(company.phoneE164)}
            whatsapp={company.whatsappE164}
            whatsappMessage={message}
            tradeInEnabled={services.trade_in}
            branches={branches.map((b) => ({ id: b.id, name: b.name, openingHours: b.openingHours as Record<string, [string, string][]> }))}
          />
        </div>
      </div>

      {similar.length > 0 && (
        <section aria-labelledby="semelhantes" className="mt-14">
          <h2 id="semelhantes" className="heading text-2xl">
            {sold ? "Alternativas disponíveis" : "Viaturas semelhantes"}
          </h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((s) => (
              <VehicleCard key={s.id} v={s} />
            ))}
          </div>
        </section>
      )}

      {!sold && <MobileContactBar phone={company.phoneE164} whatsapp={company.whatsappE164} whatsappMessage={message} reference={v.reference} price={formatPrice(v.priceCents)} />}
    </div>
  );
}

function VehicleHeading({ v, reduced, sold }: { v: Awaited<ReturnType<typeof getVehicleBySlug>>["vehicle"] & object; reduced: boolean; sold: boolean }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Plate reference={v.reference} year={v.firstRegistrationYear} month={v.firstRegistrationMonth} size="md" />
        {v.status === "reserved" && <span className="tag tag-warn">Reservado</span>}
        {sold && <span className="tag tag-dark">Vendido</span>}
        {v.status === "available" && <span className="tag tag-ok">Disponível</span>}
      </div>
      <h1 className="display mt-3 text-3xl leading-tight md:text-4xl">
        {v.make} {v.model}
      </h1>
      {v.versionName && <p className="mt-1 text-lg text-ink-soft">{v.versionName}</p>}
      <div className="mt-4">
        {reduced && <p className="text-sm text-muted line-through num">{formatPrice(v.previousPriceCents)}</p>}
        <p className="heading text-4xl num">{formatPrice(v.priceCents)}</p>
        {v.priceCents !== null && <p className="mt-1 text-sm text-muted">{VAT_LABEL[v.vatRegime]}. Preço total de venda.</p>}
      </div>
    </div>
  );
}

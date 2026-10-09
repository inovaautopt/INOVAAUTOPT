import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";
import { getPublicSettings } from "@/lib/settings";
import { getBranches, directionsUrl, summarizeHours } from "@/lib/branches";
import { callCostNote, formatPhone } from "@/lib/phone";
import { LeadForm } from "@/components/forms/LeadForm";
import { AppointmentForm } from "@/components/forms/AppointmentForm";
import { WhatsAppLink } from "@/components/vehicle/WhatsAppLink";
import { MapEmbed } from "@/components/site/MapEmbed";

export const metadata: Metadata = { title: "Contactos", description: "Telefone, email, WhatsApp, morada, horário e direções do stand.", alternates: { canonical: "/contactos" } };

export default async function ContactsPage() {
  const [{ company, legal }, branches] = await Promise.all([getPublicSettings(), getBranches()]);
  return (
    <div className="mx-auto max-w-[90rem] px-4 py-10 md:px-6">
      <h1 className="display text-[2rem] xs:text-4xl md:text-5xl">Contactos</h1>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-8">
          <ul className="space-y-3">
            {company.phoneE164 && (
              <li>
                <a href={`tel:${company.phoneE164}`} className="btn btn-outline w-full justify-start sm:w-auto">
                  <Phone aria-hidden className="h-4 w-4" /> {formatPhone(company.phoneE164)}
                </a>
                {callCostNote(company.phoneE164) && <p className="mt-1 text-xs text-muted">{callCostNote(company.phoneE164)}</p>}
              </li>
            )}
            {company.whatsappE164 && (
              <li>
                <WhatsAppLink phone={company.whatsappE164} message="Olá, gostaria de falar com o stand." className="w-full justify-start sm:w-auto" />
              </li>
            )}
            {company.email && (
              <li>
                <a href={`mailto:${company.email}`} className="btn btn-outline w-full justify-start sm:w-auto">
                  <Mail aria-hidden className="h-4 w-4" /> {company.email}
                </a>
              </li>
            )}
            {!company.phoneE164 && !company.email && !company.whatsappE164 && <li className="text-ink-soft">Os contactos do stand ainda estão a ser configurados. Usa o formulário nesta página.</li>}
          </ul>

          {branches.map((b) => (
            <section key={b.id} aria-labelledby={`b-${b.slug}`} className="space-y-4">
              <h2 id={`b-${b.slug}`} className="heading text-2xl">
                {b.name}
              </h2>
              {b.addressLine && (
                <p className="flex gap-2">
                  <MapPin aria-hidden className="mt-0.5 h-5 w-5 flex-none text-muted" />
                  <span>
                    {b.addressLine}
                    <br />
                    {[b.postalCode, b.city].filter(Boolean).join(" ")}
                  </span>
                </p>
              )}
              <dl className="grid max-w-sm grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {summarizeHours(b.openingHours).map((r) => (
                  <div key={r.days} className="contents">
                    <dt className="font-semibold">{r.days}</dt>
                    <dd className="num">{r.hours}</dd>
                  </div>
                ))}
              </dl>
              {b.latitude !== null && b.longitude !== null ? (
                <MapEmbed lat={b.latitude} lng={b.longitude} label={b.name} directions={directionsUrl(b)} consentVersion={legal.consentVersion} />
              ) : (
                directionsUrl(b) && (
                  <a href={directionsUrl(b)!} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                    Obter direções
                  </a>
                )
              )}
            </section>
          ))}
        </div>

        <div className="space-y-8">
          <section aria-labelledby="escrever" className="rounded-[var(--radius-md)] border border-line bg-surface p-5">
            <h2 id="escrever" className="heading text-2xl">
              Envia-nos uma mensagem
            </h2>
            <div className="mt-4">
              <LeadForm whatsappAvailable={Boolean(company.whatsappE164)} />
            </div>
          </section>
          {branches.length > 0 && (
            <section aria-labelledby="visitar" className="rounded-[var(--radius-md)] border border-line bg-surface p-5">
              <h2 id="visitar" className="heading text-2xl">
                Marcar visita
              </h2>
              <div className="mt-4">
                <AppointmentForm branches={branches.map((b) => ({ id: b.id, name: b.name, openingHours: b.openingHours }))} whatsappAvailable={Boolean(company.whatsappE164)} />
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

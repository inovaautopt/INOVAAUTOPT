"use client";
import { useState } from "react";
import { Phone } from "lucide-react";
import { LeadForm } from "@/components/forms/LeadForm";
import { AppointmentForm } from "@/components/forms/AppointmentForm";
import { TradeInForm } from "@/components/forms/TradeInForm";
import { WhatsAppLink } from "./WhatsAppLink";
import { trackEvent } from "@/components/consent/Analytics";
import { formatPhone } from "@/lib/phone";

type Tab = "info" | "visit" | "trade_in";

export interface ContactPanelProps {
  vehicle: { id: string; reference: string; title: string };
  sold: boolean;
  phone: string | null;
  phoneNote: string | null;
  whatsapp: string | null;
  whatsappMessage: string;
  tradeInEnabled: boolean;
  branches: { id: string; name: string; openingHours: Record<string, [string, string][]> }[];
}

export function ContactPanel(p: ContactPanelProps) {
  const [tab, setTab] = useState<Tab>("info");
  const tabs: { key: Tab; label: string }[] = [
    { key: "info", label: "Pedir informação" },
    ...(!p.sold ? [{ key: "visit" as Tab, label: "Marcar visita" }] : []),
    ...(p.tradeInEnabled && !p.sold ? [{ key: "trade_in" as Tab, label: "Propor retoma" }] : []),
  ];
  return (
    <section id="contactar" aria-labelledby="contactar-titulo" className="scroll-mt-20 rounded-[var(--radius-md)] border border-line bg-surface p-4 md:p-5">
      <h2 id="contactar-titulo" className="heading text-xl">
        {p.sold ? "Procuras uma viatura parecida?" : "Interessado nesta viatura?"}
      </h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {p.whatsapp && <WhatsAppLink phone={p.whatsapp} message={p.whatsappMessage} reference={p.vehicle.reference} className="w-full" />}
        {p.phone && (
          <a href={`tel:${p.phone}`} className="btn btn-outline w-full" onClick={() => trackEvent("phone_click", { vehicle_reference: p.vehicle.reference })}>
            <Phone aria-hidden className="h-4 w-4" /> {formatPhone(p.phone)}
          </a>
        )}
      </div>
      {p.phoneNote && <p className="mt-1 text-xs text-muted">{p.phoneNote}</p>}

      {tabs.length > 1 && (
        <div role="tablist" aria-label="Tipo de pedido" className="mt-5 flex gap-1 overflow-x-auto border-b border-line">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              type="button"
              id={`tab-${t.key}`}
              aria-selected={tab === t.key}
              aria-controls={`panel-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold ${tab === t.key ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      <div className="mt-4" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "info" && (
          <LeadForm
            vehicle={p.vehicle}
            whatsappAvailable={Boolean(p.whatsapp)}
            defaultMessage={p.sold ? `Olá, vi que a viatura ${p.vehicle.title} (referência ${p.vehicle.reference}) já foi vendida. Têm alguma parecida?` : undefined}
          />
        )}
        {tab === "visit" && <AppointmentForm vehicle={p.vehicle} branches={p.branches} whatsappAvailable={Boolean(p.whatsapp)} />}
        {tab === "trade_in" && <TradeInForm vehicle={p.vehicle} whatsappAvailable={Boolean(p.whatsapp)} />}
      </div>
    </section>
  );
}

/** Barra fixa no telemóvel: contactos sempre acessíveis sem tapar o conteúdo (o rodapé reserva espaço). */
export function MobileContactBar({ phone, whatsapp, whatsappMessage, reference, price }: { phone: string | null; whatsapp: string | null; whatsappMessage: string; reference: string; price: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-3 py-2 shadow-[var(--shadow-bar)] backdrop-blur lg:hidden" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
      <div className="mx-auto flex max-w-xl items-center gap-2">
        <span className="heading mr-auto text-lg num">{price}</span>
        {phone && (
          <a href={`tel:${phone}`} className="btn btn-outline h-11 w-11 px-0" aria-label="Telefonar" onClick={() => trackEvent("phone_click", { vehicle_reference: reference })}>
            <Phone aria-hidden className="h-5 w-5" />
          </a>
        )}
        {whatsapp && <WhatsAppLink phone={whatsapp} message={whatsappMessage} reference={reference} label="WhatsApp" />}
        <a href="#contactar" className="btn btn-primary">
          Contactar
        </a>
      </div>
    </div>
  );
}

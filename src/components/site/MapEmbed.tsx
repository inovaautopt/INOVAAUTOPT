"use client";
import { MapPin } from "lucide-react";
import { setPanelOpen, useConsent } from "@/components/consent/consent-store";

/** Mapa incorporado só com consentimento de conteúdos externos. A ligação externa funciona sempre. */
export function MapEmbed({ lat, lng, label, directions, consentVersion }: { lat: number; lng: number; label: string; directions: string | null; consentVersion: string }) {
  const consent = useConsent(consentVersion);
  if (consent?.external) {
    return (
      <iframe
        title={`Mapa: ${label}`}
        src={`https://www.google.com/maps?q=${lat},${lng}&z=16&output=embed`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="aspect-[4/3] w-full rounded-[var(--radius-md)] border border-line md:aspect-video"
      />
    );
  }
  return (
    <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-[var(--radius-md)] border border-dashed border-line-strong bg-surface p-6 text-center md:aspect-video">
      <MapPin aria-hidden className="h-8 w-8 text-muted" />
      <p className="max-w-sm text-sm text-ink-soft">O mapa é carregado a partir do Google Maps. Para o veres aqui, autoriza conteúdos externos.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setPanelOpen(true)}>
          Mostrar mapa
        </button>
        {directions && (
          <a href={directions} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
            Abrir no Google Maps
          </a>
        )}
      </div>
    </div>
  );
}

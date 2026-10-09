"use client";
import { useEffect } from "react";
import { useConsent } from "./consent-store";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
  }
}

function loadScript(src: string, id: string) {
  if (document.getElementById(id)) return;
  const s = document.createElement("script");
  s.id = id;
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

/**
 * Carrega GA4 e Meta Pixel SÓ depois do consentimento correspondente.
 * Nunca envia dados pessoais (nome, email, telefone, mensagem, matrícula, VIN).
 */
export function Analytics({ version, ga4Id, pixelId }: { version: string; ga4Id?: string; pixelId?: string }) {
  const consent = useConsent(version);

  useEffect(() => {
    if (!consent?.analytics || !ga4Id) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", ga4Id, { anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false });
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`, "ga4");
  }, [consent?.analytics, ga4Id]);

  useEffect(() => {
    if (!consent?.marketing || !pixelId || window.fbq) return;
    // Equivalente ao snippet oficial da Meta, sem código inline
    type Fbq = NonNullable<Window["fbq"]> & { callMethod?: (...a: unknown[]) => void };
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue!.push(args);
    } as Fbq;
    fbq.push = fbq;
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = "2.0";
    window.fbq = fbq;
    loadScript("https://connect.facebook.net/en_US/fbevents.js", "meta-pixel");
    fbq("init", pixelId);
    fbq("track", "PageView");
  }, [consent?.marketing, pixelId]);

  return null;
}

/** Evento analítico sem dados pessoais. Só é enviado se o GA4 já tiver sido autorizado e carregado. */
export function trackEvent(name: "contact_click" | "lead_submitted" | "whatsapp_click" | "phone_click" | "search", params: Record<string, string | number> = {}) {
  const safe = Object.fromEntries(Object.entries(params).filter(([k]) => ["vehicle_reference", "form", "channel", "results"].includes(k)));
  window.gtag?.("event", name, safe);
}

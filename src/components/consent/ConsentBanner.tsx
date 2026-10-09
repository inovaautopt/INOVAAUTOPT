"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { saveConsent, setPanelOpen, useConsent, useHydrated, usePanelOpen } from "./consent-store";

export function ConsentBanner({ version, analyticsAvailable, marketingAvailable }: { version: string; analyticsAvailable: boolean; marketingAvailable: boolean }) {
  const hydrated = useHydrated();
  const consent = useConsent(version);
  const panelOpen = usePanelOpen();
  const showBar = hydrated && !consent && !panelOpen;

  return (
    <>
      {showBar && (
        <section
          aria-label="Cookies"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface p-4 shadow-[var(--shadow-bar)] md:inset-x-auto md:bottom-4 md:left-4 md:max-w-xl md:rounded-[var(--radius-md)] md:border"
        >
          <p className="text-sm leading-relaxed">
            Usamos cookies essenciais para o site funcionar. Com a tua autorização, usamos também cookies de medição de audiência e conteúdos externos, como mapas.{" "}
            <Link href="/cookies" className="font-semibold text-brand-ink underline underline-offset-2">
              Saber mais
            </Link>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn btn-dark btn-sm" onClick={() => saveConsent({ version, analytics: analyticsAvailable, marketing: marketingAvailable, external: true })}>
              Aceitar todos
            </button>
            <button type="button" className="btn btn-dark btn-sm" onClick={() => saveConsent({ version, analytics: false, marketing: false, external: false })}>
              Rejeitar não essenciais
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setPanelOpen(true)}>
              Personalizar
            </button>
          </div>
        </section>
      )}
      {panelOpen && <ConsentPanel version={version} analyticsAvailable={analyticsAvailable} marketingAvailable={marketingAvailable} />}
    </>
  );
}

function ConsentPanel({ version, analyticsAvailable, marketingAvailable }: { version: string; analyticsAvailable: boolean; marketingAvailable: boolean }) {
  const current = useConsent(version);
  const [analytics, setAnalytics] = useState(current?.analytics ?? false);
  const [marketing, setMarketing] = useState(current?.marketing ?? false);
  const [external, setExternal] = useState(current?.external ?? false);
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const options = [
    { key: "necessary", label: "Essenciais", desc: "Necessários para o site funcionar (por exemplo, guardar esta escolha, favoritos e comparador). Não podem ser desativados.", checked: true, disabled: true, set: () => {} },
    ...(analyticsAvailable
      ? [{ key: "analytics", label: "Medição de audiência", desc: "Google Analytics 4: estatísticas agregadas de utilização. Sem nomes, emails ou telefones.", checked: analytics, disabled: false, set: setAnalytics }]
      : []),
    ...(marketingAvailable
      ? [{ key: "marketing", label: "Publicidade", desc: "Meta Pixel: medir a eficácia de anúncios. Sem dados de contacto.", checked: marketing, disabled: false, set: setMarketing }]
      : []),
    { key: "external", label: "Conteúdos externos", desc: "Mapas do Google e vídeos (YouTube/Vimeo) incorporados nas páginas. Sem esta opção, mostramos uma ligação.", checked: external, disabled: false, set: setExternal },
  ];

  return (
    <dialog ref={ref} aria-labelledby={titleId} onClose={() => setPanelOpen(false)} className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-[var(--radius-md)] bg-surface p-0 backdrop:bg-ink/50">
      <form
        method="dialog"
        className="p-5"
        onSubmit={(e) => {
          e.preventDefault();
          saveConsent({ version, analytics: analyticsAvailable && analytics, marketing: marketingAvailable && marketing, external });
        }}
      >
        <h2 id={titleId} className="heading text-xl">
          Preferências de cookies
        </h2>
        <ul className="mt-4 divide-y divide-line">
          {options.map((o) => (
            <li key={o.key} className="flex gap-3 py-3">
              <input id={`c-${o.key}`} type="checkbox" className="check" checked={o.checked} disabled={o.disabled} onChange={(e) => o.set(e.target.checked)} />
              <label htmlFor={`c-${o.key}`} className="text-sm">
                <span className="block font-semibold">{o.label}</span>
                <span className="text-muted">{o.desc}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary">
            Guardar escolhas
          </button>
          <button type="button" className="btn btn-outline" onClick={() => saveConsent({ version, analytics: false, marketing: false, external: false })}>
            Rejeitar não essenciais
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setPanelOpen(false)}>
            Fechar
          </button>
        </div>
      </form>
    </dialog>
  );
}

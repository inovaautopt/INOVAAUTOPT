import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicSettings } from "@/lib/settings";
import { TradeInForm } from "@/components/forms/TradeInForm";
import { getFaqs } from "@/lib/content";

export const metadata: Metadata = { title: "Retomas", description: "Pede a avaliação da tua viatura para retoma.", alternates: { canonical: "/retomas" } };

export default async function TradeInPage() {
  const { services, company } = await getPublicSettings();
  if (!services.trade_in) notFound();
  const faqs = await getFaqs("trade_in");
  return (
    <div className="mx-auto grid max-w-[90rem] grid-cols-1 gap-10 px-4 py-10 md:px-6 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <h1 className="display text-[2rem] xs:text-4xl md:text-5xl">Retomas</h1>
        <p className="mt-4 max-w-[50ch] text-lg text-ink-soft">Conta-nos como é a tua viatura atual. Analisamos o pedido e contactamos-te para a avaliação, que fica sempre sujeita a vermos a viatura.</p>
        {faqs.length > 0 && (
          <div className="mt-8 divide-y divide-line rounded-[var(--radius-md)] border border-line bg-surface">
            {faqs.map((f) => (
              <details key={f.id} className="p-4">
                <summary className="cursor-pointer font-semibold">{f.question}</summary>
                <p className="mt-2 whitespace-pre-line text-sm text-ink-soft">{f.answer}</p>
              </details>
            ))}
          </div>
        )}
      </div>
      <section aria-label="Formulário de retoma" className="rounded-[var(--radius-md)] border border-line bg-surface p-5">
        <TradeInForm whatsappAvailable={Boolean(company.whatsappE164)} />
      </section>
    </div>
  );
}

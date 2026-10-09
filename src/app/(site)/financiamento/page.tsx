import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicSettings } from "@/lib/settings";
import { LeadForm } from "@/components/forms/LeadForm";
import { getFaqs } from "@/lib/content";

export const metadata: Metadata = { title: "Financiamento", alternates: { canonical: "/financiamento" } };

/**
 * Financiamento como pedido de contacto. Não há simulador nem mensalidades no site enquanto
 * não existirem condições reais, vigentes e aprovadas pelo parceiro (ver docs/DECISIONS.md).
 */
export default async function FinancingPage() {
  const { services, company, legal } = await getPublicSettings();
  if (!services.financing) notFound();
  const faqs = await getFaqs("financing");
  return (
    <div className="mx-auto grid max-w-[90rem] grid-cols-1 gap-10 px-4 py-10 md:px-6 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <h1 className="display text-[2rem] xs:text-4xl md:text-5xl">Financiamento</h1>
        <p className="mt-4 max-w-[50ch] text-lg text-ink-soft">Diz-nos que viatura te interessa e como pretendes pagar. Respondemos com as opções disponíveis para o teu caso.</p>
        <p className="mt-4 max-w-[50ch] text-sm text-muted">Neste formulário não pedimos documentos de identificação, recibos de vencimento nem dados bancários. Um pedido de informação não é um pedido nem uma aprovação de crédito.</p>
        {legal.creditIntermediaryText && <p className="mt-4 max-w-[60ch] whitespace-pre-line text-sm text-ink-soft">{legal.creditIntermediaryText}</p>}
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
      <section aria-label="Pedido de informação sobre financiamento" className="rounded-[var(--radius-md)] border border-line bg-surface p-5">
        <LeadForm kind="financing" whatsappAvailable={Boolean(company.whatsappE164)} defaultMessage="Olá, gostaria de saber as opções de financiamento para a viatura " submitLabel="Pedir informação" />
      </section>
    </div>
  );
}

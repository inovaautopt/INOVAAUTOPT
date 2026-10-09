import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicSettings } from "@/lib/settings";
import { SERVICES, SERVICE_LABEL, type ServiceKey } from "@/lib/domain";

export const metadata: Metadata = { title: "Serviços", alternates: { canonical: "/servicos" } };

const DESCRIPTION: Record<ServiceKey, string> = {
  trade_in: "Avaliamos a tua viatura atual como parte do pagamento. A avaliação final é feita ao ver a viatura.",
  financing: "Pede-nos informação sobre opções de financiamento. Respondemos com as condições aplicáveis ao teu caso.",
  delivery: "Combina connosco a entrega da viatura.",
  workshop: "Serviço de oficina. Fala connosco para marcar.",
  import: "Procuramos e importamos a viatura que pretendes, por encomenda.",
  extended_warranty: "Pergunta-nos pelas opções de extensão de garantia disponíveis.",
  after_sales: "Acompanhamento depois da compra.",
};

export default async function ServicesPage() {
  const { services } = await getPublicSettings();
  const active = SERVICES.filter((s) => services[s]);
  if (active.length === 0) notFound();
  return (
    <div className="mx-auto max-w-[90rem] px-4 py-10 md:px-6">
      <h1 className="display text-[2rem] xs:text-4xl md:text-5xl">Serviços</h1>
      <ul className="mt-8 grid gap-4 md:grid-cols-2">
        {active.map((s) => (
          <li key={s} id={s} className="scroll-mt-24 rounded-[var(--radius-md)] border border-line bg-surface p-5">
            <h2 className="heading text-xl">{SERVICE_LABEL[s]}</h2>
            <p className="mt-2 text-ink-soft">{DESCRIPTION[s]}</p>
            <Link href={s === "trade_in" ? "/retomas" : s === "financing" ? "/financiamento" : "/contactos"} className="btn btn-outline btn-sm mt-4">
              {s === "trade_in" ? "Pedir avaliação" : s === "financing" ? "Pedir informação" : "Contactar"}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

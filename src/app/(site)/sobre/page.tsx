import type { Metadata } from "next";
import Link from "next/link";
import { getPublicSettings } from "@/lib/settings";
import { ContentPage } from "@/components/site/ContentPage";
import { getPageForDisplay } from "@/lib/content";
import { isProduction } from "@/lib/env";

export const metadata: Metadata = { title: "Sobre nós", alternates: { canonical: "/sobre" } };

export default async function AboutPage() {
  const page = await getPageForDisplay("sobre", isProduction());
  if (page) return <ContentPage slug="sobre" fallbackTitle="Sobre nós" />;
  const { company } = await getPublicSettings();
  return (
    <div className="mx-auto max-w-[90rem] px-4 py-10 md:px-6">
      <h1 className="display text-[2rem] xs:text-4xl md:text-5xl">Sobre a {company.tradeName}</h1>
      {company.aboutText ? <p className="prose-inova mt-6 whitespace-pre-line text-lg">{company.aboutText}</p> : <p className="mt-6 max-w-[60ch] text-lg text-ink-soft">Somos um stand automóvel. Vê as viaturas disponíveis ou fala connosco.</p>}
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/viaturas" className="btn btn-primary">
          Ver viaturas
        </Link>
        <Link href="/contactos" className="btn btn-outline">
          Contactos
        </Link>
      </div>
    </div>
  );
}

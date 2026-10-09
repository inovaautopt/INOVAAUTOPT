import type { MetadataRoute } from "next";
import { getPublicSlugs } from "@/lib/vehicles";
import { getPublicSettings } from "@/lib/settings";
import { getGuides } from "@/lib/content";
import { isProduction } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Só páginas indexáveis: sem filtros, favoritos, comparador, admin, vendidas ou demonstração. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  if (!isProduction()) return [];
  const [vehicles, { services }, guides] = await Promise.all([getPublicSlugs(), getPublicSettings(), getGuides()]);
  const pages = ["/", "/viaturas", "/sobre", "/contactos", "/privacidade", "/cookies", "/termos", "/reclamacoes"];
  if (services.trade_in) pages.push("/retomas");
  if (services.financing) pages.push("/financiamento");
  if (Object.values(services).some(Boolean)) pages.push("/servicos");
  if (guides.length) pages.push("/guias");
  return [
    ...pages.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const })),
    ...vehicles.map((v) => ({ url: `${base}/viaturas/${v.slug}`, lastModified: v.updatedAt, changeFrequency: "daily" as const })),
    ...guides.map((g) => ({ url: `${base}/${g.slug}`, lastModified: g.updatedAt })),
  ];
}

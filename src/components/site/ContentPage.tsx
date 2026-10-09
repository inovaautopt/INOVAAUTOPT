import { notFound } from "next/navigation";
import { getPageForDisplay, interpolate, renderMarkdown } from "@/lib/content";
import { getPublicSettings } from "@/lib/settings";
import { getBranches } from "@/lib/branches";
import { isProduction } from "@/lib/env";
import { formatDate } from "@/lib/format";

export async function ContentPage({ slug, fallbackTitle, children }: { slug: string; fallbackTitle: string; children?: React.ReactNode }) {
  const production = isProduction();
  const [page, settings, branches] = await Promise.all([getPageForDisplay(slug, production), getPublicSettings(), getBranches()]);
  if (!page && !children) notFound();
  const rendered = page ? interpolate(page.body, settings, branches) : null;
  return (
    <article className="mx-auto max-w-[90rem] px-4 py-10 md:px-6">
      <h1 className="display text-4xl md:text-5xl">{page?.title ?? fallbackTitle}</h1>
      {page && page.status !== "published" && (
        <div role="note" className="mt-4 max-w-[68ch] rounded-[var(--radius-sm)] bg-warn-soft p-3 text-sm text-warn">
          <strong>Texto por validar.</strong> Esta página não está publicada e só aparece em ambiente de testes.
          {rendered && rendered.missing.length > 0 && <> Faltam dados: {rendered.missing.join(", ")}.</>}
        </div>
      )}
      {page?.summary && <p className="mt-4 max-w-[60ch] text-lg text-ink-soft">{page.summary}</p>}
      {rendered && <div className="prose-inova mt-6" dangerouslySetInnerHTML={{ __html: renderMarkdown(rendered.text) }} />}
      {children}
      {page?.publishedAt && <p className="mt-10 text-xs text-muted">Última atualização: {formatDate(page.updatedAt)}</p>}
    </article>
  );
}

/** Página legal em falta em produção: informa sem inventar conteúdo. */
export function LegalUnavailable({ email }: { email: string | null }) {
  return (
    <div className="mx-auto max-w-[90rem] px-4 py-10 md:px-6">
      <h1 className="display text-4xl">Em atualização</h1>
      <p className="mt-4 max-w-[60ch]">Esta informação está a ser atualizada. {email ? <>Para qualquer questão, escreve-nos para <a className="underline" href={`mailto:${email}`}>{email}</a>.</> : null}</p>
    </div>
  );
}

import "server-only";
import { cache } from "react";
import sanitizeHtml from "sanitize-html";
import { asPublic } from "./db";
import type { PublicSettings } from "./settings";
import type { Branch } from "./branches";
import { formatPhone } from "./phone";

export interface SitePage {
  id: string;
  slug: string;
  kind: "page" | "guide" | "legal";
  title: string;
  summary: string | null;
  body: string;
  status: "draft" | "needs_validation" | "published";
  publishedAt: Date | null;
  updatedAt: Date;
}

export const getPublishedPage = cache(async (slug: string): Promise<SitePage | null> => {
  return asPublic(async (tx) => {
    const [p] = (await tx`select id, slug, kind, title, summary, body, status, published_at, updated_at
      from app.site_pages where slug = ${slug} and status = 'published'`) as unknown as SitePage[];
    return p ?? null;
  });
});

export async function getGuides(): Promise<SitePage[]> {
  return asPublic(async (tx) => {
    return (await tx`select id, slug, kind, title, summary, body, status, published_at, updated_at
      from app.site_pages where kind = 'guide' and status = 'published' order by published_at desc nulls last`) as unknown as SitePage[];
  });
}

export async function getFaqs(scope: "general" | "vehicle" | "financing" | "trade_in"): Promise<{ id: string; question: string; answer: string }[]> {
  return asPublic(async (tx) => {
    return (await tx`select id, question, answer from app.faqs where scope = ${scope} and is_published order by position, question`) as unknown as {
      id: string;
      question: string;
      answer: string;
    }[];
  });
}

/**
 * Substitui marcadores {{empresa.nome_legal}} pelos dados configurados. Dados em falta ficam
 * destacados como «por preencher» — nunca são inventados. Devolve também a lista do que falta.
 */
export function interpolate(body: string, s: PublicSettings, branches: Branch[]): { text: string; missing: string[] } {
  const b = branches[0];
  const values: Record<string, string | null | undefined> = {
    "empresa.nome": s.company.tradeName,
    "empresa.nome_legal": s.company.legalName,
    "empresa.nif": s.company.nif,
    "empresa.email": s.company.email,
    "empresa.telefone": s.company.phoneE164 ? formatPhone(s.company.phoneE164) : null,
    "empresa.email_privacidade": s.company.privacyEmail ?? s.company.email,
    "empresa.morada": b ? [b.addressLine, b.postalCode, b.city].filter(Boolean).join(", ") || null : null,
    "legal.ral_nome": s.legal.ralEntityName,
    "legal.ral_url": s.legal.ralEntityUrl,
    "legal.ral_morada": s.legal.ralEntityAddress,
    "legal.livro_reclamacoes": s.legal.complaintsBookUrl,
    "legal.retencao": s.legal.dataRetentionText,
    "legal.intermediario_credito": s.legal.creditIntermediaryText,
  };
  const missing: string[] = [];
  const text = body.replace(/\{\{\s*([a-z_.]+)\s*\}\}/g, (_, key: string) => {
    const v = values[key];
    if (v) return v;
    missing.push(key);
    return `==por preencher: ${key}==`;
  });
  return { text, missing: [...new Set(missing)] };
}

/** Markdown restrito → HTML seguro (títulos, parágrafos, listas, negrito, itálico, ligações). */
export function renderMarkdown(md: string): string {
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    escape(s)
      .replace(/==(.+?)==/g, "<mark>$1</mark>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*|mailto:[^\s)]+)\)/g, '<a href="$2">$1</a>');
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
  };
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m: RegExpMatchArray | null;
    if (line.trim() === "") {
      flushPara();
      closeList();
    } else if ((m = line.match(/^(#{2,3})\s+(.*)$/))) {
      flushPara();
      closeList();
      const level = m[1]!.length;
      out.push(`<h${level}>${inline(m[2]!)}</h${level}>`);
    } else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      flushPara();
      if (list !== "ul") {
        closeList();
        out.push("<ul>");
        list = "ul";
      }
      out.push(`<li>${inline(m[1]!)}</li>`);
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      flushPara();
      if (list !== "ol") {
        closeList();
        out.push("<ol>");
        list = "ol";
      }
      out.push(`<li>${inline(m[1]!)}</li>`);
    } else {
      closeList();
      para.push(line.trim());
    }
  }
  flushPara();
  closeList();
  return sanitizeHtml(out.join("\n"), {
    allowedTags: ["h2", "h3", "p", "ul", "ol", "li", "strong", "em", "a", "mark", "br"],
    allowedAttributes: { a: ["href", "rel", "target"] },
    allowedSchemes: ["https", "http", "mailto"],
    transformTags: {
      a: (tagName, attribs) => {
        const external = /^https?:/.test(attribs.href ?? "");
        return { tagName, attribs: external ? { ...attribs, rel: "noopener noreferrer", target: "_blank" } : attribs };
      },
    },
  });
}

/** Fora de produção mostra também rascunhos (com aviso), para validação. */
export async function getPageForDisplay(slug: string, production: boolean): Promise<SitePage | null> {
  if (production) return getPublishedPage(slug);
  const { asSystem } = await import("./db");
  return asSystem(async (tx) => {
    const [p] = (await tx`select id, slug, kind, title, summary, body, status, published_at, updated_at
      from app.site_pages where slug = ${slug}`) as unknown as SitePage[];
    return p ?? null;
  });
}

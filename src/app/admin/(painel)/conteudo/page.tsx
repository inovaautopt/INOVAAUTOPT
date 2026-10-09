import Link from "next/link";
import { requireStaff, withStaff } from "@/server/auth";
import { PageHeader } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/ActionForm";
import { formatShortDateTime } from "@/lib/format";
import { saveFaqAction } from "./actions";

const KIND = { page: "Página", guide: "Guia", legal: "Legal" } as const;
const STATUS = { draft: ["Rascunho", ""], needs_validation: ["Por validar", "tag-warn"], published: ["Publicada", "tag-ok"] } as const;
const SCOPE = { general: "Geral", vehicle: "Ficha de viatura", financing: "Financiamento", trade_in: "Retomas" } as const;

export default async function Content() {
  await requireStaff(["admin", "stock_manager"]);
  const { pages, faqs } = await withStaff(undefined, async (tx) => ({
    pages: (await tx`select id, slug, kind, title, status, updated_at from app.site_pages order by kind, title`) as unknown as { id: string; slug: string; kind: keyof typeof KIND; title: string; status: keyof typeof STATUS; updatedAt: Date }[],
    faqs: (await tx`select id, scope, question, answer, position, is_published from app.faqs order by scope, position`) as unknown as { id: string; scope: keyof typeof SCOPE; question: string; answer: string; position: number; isPublished: boolean }[],
  }));
  return (
    <>
      <PageHeader title="Conteúdo" description="Páginas, guias, textos legais e perguntas frequentes. Textos legais só são publicados com todos os dados preenchidos." actions={<Link href="/admin/conteudo/nova" className="btn btn-primary">Nova página</Link>} />
      <div className="panel overflow-x-auto">
        <table className="table">
          <thead><tr><th>Título</th><th>Tipo</th><th>Endereço</th><th>Estado</th><th>Atualizada</th></tr></thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.id}>
                <td><Link href={`/admin/conteudo/${p.id}`} className="font-semibold hover:underline">{p.title}</Link></td>
                <td>{KIND[p.kind]}</td>
                <td className="font-mono text-xs">/{p.slug}</td>
                <td><span className={`tag ${STATUS[p.status][1]}`}>{STATUS[p.status][0]}</span></td>
                <td className="num text-muted">{formatShortDateTime(p.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="heading mt-10 text-xl">Perguntas frequentes</h2>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {[...faqs, null].map((f) => (
          <div key={f?.id ?? "new"} className="panel p-4">
            <ActionForm action={saveFaqAction} submitLabel={f ? "Guardar" : "Adicionar pergunta"} submitClassName="btn-sm" resetOnSuccess={!f}>
              {f && <input type="hidden" name="id" value={f.id} />}
              <div className="flex gap-2">
                <select name="scope" defaultValue={f?.scope ?? "general"} className="input" aria-label="Onde aparece">
                  {Object.entries(SCOPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input name="position" type="number" defaultValue={f?.position ?? 0} className="input w-20" aria-label="Ordem" />
              </div>
              <input name="question" defaultValue={f?.question} className="input" placeholder="Pergunta" aria-label="Pergunta" />
              <textarea name="answer" defaultValue={f?.answer} className="input min-h-20" placeholder="Resposta (só informação confirmada)" aria-label="Resposta" />
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" name="isPublished" defaultChecked={f?.isPublished} className="check" /> Publicada</label>
                {f && <label className="flex items-center gap-2 text-danger"><input type="checkbox" name="delete" className="check" /> Apagar</label>}
              </div>
            </ActionForm>
          </div>
        ))}
      </div>
    </>
  );
}

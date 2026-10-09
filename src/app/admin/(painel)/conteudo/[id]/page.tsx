import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff, withStaff } from "@/server/auth";
import { PageHeader } from "@/components/admin/ui";
import { ActionForm, FieldMsg } from "@/components/admin/ActionForm";
import { savePageAction } from "../actions";

export default async function EditPage(props: PageProps<"/admin/conteudo/[id]">) {
  const s = await requireStaff(["admin", "stock_manager"]);
  const { id } = await props.params;
  const isNew = id === "nova";
  if (!isNew && !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const page = isNew
    ? null
    : await withStaff(undefined, async (tx) => ((await tx`select * from app.site_pages where id = ${id}`) as unknown as { id: string; slug: string; kind: string; title: string; summary: string | null; body: string; status: string; version: number }[])[0]);
  if (!isNew && !page) notFound();
  return (
    <>
      <PageHeader title={page?.title ?? "Nova página"} actions={page?.status === "published" && <Link className="btn btn-outline" href={`/${page.slug}`} target="_blank">Ver no site</Link>} />
      <div className="panel p-5">
        <ActionForm action={savePageAction} submitLabel="Guardar">
          <>
            <>
              {page && <input type="hidden" name="id" value={page.id} />}
              {page && <input type="hidden" name="version" value={page.version} />}
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="field-label" htmlFor="title">Título</label>
                  <input id="title" name="title" defaultValue={page?.title} className="input" />
                  <FieldMsg name="title" />
                </div>
                <div>
                  <label className="field-label" htmlFor="slug">Endereço</label>
                  <input id="slug" name="slug" defaultValue={page?.slug ?? "guias/"} className="input font-mono" readOnly={page?.kind === "legal"} />
                  <p className="field-hint">Guias: guias/nome-do-guia</p>
                  <FieldMsg name="slug" />
                </div>
                <div>
                  <label className="field-label" htmlFor="kind">Tipo</label>
                  <select id="kind" name="kind" defaultValue={page?.kind ?? "guide"} className="input">
                    <option value="guide">Guia</option>
                    <option value="page">Página</option>
                    {s.profile.role === "admin" && <option value="legal">Legal</option>}
                  </select>
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="summary">Resumo</label>
                <input id="summary" name="summary" defaultValue={page?.summary ?? ""} className="input" />
              </div>
              <div>
                <label className="field-label" htmlFor="body">Texto</label>
                <textarea id="body" name="body" defaultValue={page?.body} className="input min-h-[28rem] font-mono text-sm" />
                <p className="field-hint">Formatação: «## Título», «- item de lista», «**negrito**», «[texto](https://ligação)». Marcadores como {"{{empresa.nif}}"} são preenchidos com os dados da Configuração.</p>
              </div>
              <div>
                <label className="field-label" htmlFor="status">Estado</label>
                <select id="status" name="status" defaultValue={page?.status ?? "draft"} className="input max-w-xs">
                  <option value="draft">Rascunho</option>
                  <option value="needs_validation">Por validar</option>
                  <option value="published">Publicada</option>
                </select>
              </div>
            </>
          </>
        </ActionForm>
      </div>
    </>
  );
}

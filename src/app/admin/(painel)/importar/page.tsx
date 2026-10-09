import Link from "next/link";
import { requireStaff, withStaff } from "@/server/auth";
import { PageHeader, Notice } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/ActionForm";
import { previewImportAction, commitImportAction, discardImportAction } from "./actions";
import type { ParsedRow } from "@/lib/stock-csv";
import { formatShortDateTime } from "@/lib/format";

export default async function ImportPage(props: PageProps<"/admin/importar">) {
  await requireStaff(["admin", "stock_manager"]);
  const sp = await props.searchParams;
  const jobId = typeof sp.job === "string" && /^[0-9a-f-]{36}$/.test(sp.job) ? sp.job : null;
  const { job, history } = await withStaff(undefined, async (tx) => ({
    job: jobId ? ((await tx`select id, filename, mode, status, report, rows_total, rows_rejected from app.import_jobs where id = ${jobId}`) as unknown as {
      id: string; filename: string; mode: string; status: string; rowsTotal: number; rowsRejected: number; report: { headerErrors: string[]; rows: ParsedRow[]; missingFromFile: string[] };
    }[])[0] : null,
    history: (await tx`select j.id, j.filename, j.mode, j.status, j.rows_total, j.rows_created, j.rows_updated, j.rows_rejected, j.created_at, p.full_name
      from app.import_jobs j left join app.profiles p on p.id = j.created_by order by j.created_at desc limit 20`) as unknown as {
      id: string; filename: string; mode: string; status: string; rowsTotal: number; rowsCreated: number; rowsUpdated: number; rowsRejected: number; createdAt: Date; fullName: string | null;
    }[],
  }));
  return (
    <>
      <PageHeader title="Importar stock (CSV)" description="Primeiro um ensaio sem escrita; depois confirmas o resumo para aplicar." actions={<a href="/admin/importar/modelo" className="btn btn-outline">Descarregar modelo CSV</a>} />
      {!job && (
        <div className="panel max-w-2xl p-5">
          <ActionForm action={previewImportAction} submitLabel="Analisar ficheiro (sem gravar)">
            <div>
              <label className="field-label" htmlFor="file">Ficheiro CSV (separado por «;» ou «,», UTF-8)</label>
              <input id="file" name="file" type="file" accept=".csv,text/csv" className="block w-full text-sm" />
            </div>
            <fieldset className="space-y-2 text-sm">
              <legend className="field-label">Tipo de ficheiro</legend>
              <label className="flex gap-2"><input type="radio" name="mode" value="partial_update" defaultChecked className="check" /> Atualização parcial — só as viaturas no ficheiro são criadas/atualizadas.</label>
              <label className="flex gap-2"><input type="radio" name="mode" value="full_snapshot" className="check" /> Fotografia integral do stock — mostra também as viaturas publicadas que não estão no ficheiro (não são vendidas nem apagadas automaticamente).</label>
            </fieldset>
            <p className="text-xs text-muted">Atualizações usam a coluna «referencia» (ex.: IA-0003). Sem referência, a linha cria uma viatura nova. Fotografias por URL só de domínios autorizados.</p>
          </ActionForm>
        </div>
      )}
      {job && (
        <section className="space-y-4">
          <Notice tone={job.status === "previewed" ? "info" : job.status === "committed" ? "ok" : "warn"}>
            {job.filename} · {job.mode === "full_snapshot" ? "fotografia integral" : "atualização parcial"} · {job.rowsTotal} linhas, {job.rowsRejected} rejeitadas · estado: {job.status}
          </Notice>
          {job.report.headerErrors.length > 0 && <Notice tone="warn">{job.report.headerErrors.join(" ")}</Notice>}
          {job.report.missingFromFile.length > 0 && (
            <Notice tone="warn">Publicadas mas ausentes do ficheiro (revê manualmente; nada é alterado): {job.report.missingFromFile.join(", ")}</Notice>
          )}
          <div className="panel overflow-x-auto">
            <table className="table">
              <thead><tr><th>Linha</th><th>Ação</th><th>Referência</th><th>Viatura</th><th>Fotos</th><th>Erros</th></tr></thead>
              <tbody>
                {job.report.rows.map((r) => (
                  <tr key={r.line}>
                    <td className="num">{r.line}</td>
                    <td><span className={`tag ${r.action === "skip" ? "tag-danger" : r.action === "create" ? "tag-ok" : "tag-brand"}`}>{{ create: "Criar", update: "Atualizar", skip: "Rejeitada" }[r.action]}</span></td>
                    <td>{r.reference ?? "nova"}</td>
                    <td>{r.data ? `${r.data.make} ${r.data.model}` : "—"}</td>
                    <td>{r.photos.length}</td>
                    <td className="text-xs text-danger">{r.errors.join("; ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {job.status === "previewed" && (
            <div className="flex flex-wrap gap-2">
              <ActionForm action={commitImportAction} submitLabel="Confirmar e aplicar" pendingLabel="A importar…" confirm="Aplicar as linhas válidas ao stock?">
                <input type="hidden" name="jobId" value={job.id} />
              </ActionForm>
              <form action={discardImportAction}>
                <input type="hidden" name="jobId" value={job.id} />
                <button className="btn btn-outline">Descartar</button>
              </form>
            </div>
          )}
          <Link href="/admin/importar" className="text-sm font-semibold underline">Nova importação</Link>
        </section>
      )}
      <h2 className="heading mt-10 text-lg">Histórico</h2>
      <div className="panel mt-3 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Data</th><th>Ficheiro</th><th>Utilizador</th><th>Estado</th><th>Criadas</th><th>Atualizadas</th><th>Rejeitadas</th></tr></thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id}>
                <td className="num"><Link className="hover:underline" href={`/admin/importar?job=${h.id}`}>{formatShortDateTime(h.createdAt)}</Link></td>
                <td>{h.filename}</td>
                <td>{h.fullName}</td>
                <td>{h.status}</td>
                <td>{h.rowsCreated}</td>
                <td>{h.rowsUpdated}</td>
                <td>{h.rowsRejected}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

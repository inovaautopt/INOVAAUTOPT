import { requireStaff, withStaff } from "@/server/auth";
import { PageHeader, Notice } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/ActionForm";
import { env } from "@/lib/env";
import { formatShortDateTime } from "@/lib/format";
import { retryOutboxAction, runNowAction, saveTemplatesAction, syncTemplatesAction } from "./actions";

type State = "Ligada" | "Implementada e por ativar" | "Modo de teste" | "Desativada";

function Row({ name, state, detail }: { name: string; state: State; detail?: string }) {
  const tone = state === "Ligada" ? "tag-ok" : state === "Modo de teste" ? "tag-warn" : "";
  return (
    <tr>
      <td className="font-semibold">{name}</td>
      <td><span className={`tag ${tone}`}>{state}</span></td>
      <td className="text-xs text-muted">{detail}</td>
    </tr>
  );
}

export default async function Integrations() {
  await requireStaff(["admin"]);
  const e = env();
  const data = await withStaff(["admin"], async (tx) => ({
    instance: ((await tx`select environment from app.instance`) as unknown as { environment: string }[])[0]?.environment,
    outboxStats: (await tx`select status, count(*)::int as n, max(coalesce(sent_at, created_at)) as last from app.notification_outbox group by status`) as unknown as { status: string; n: number; last: Date }[],
    failures: (await tx`select id, kind, channel, status, attempts, last_error, created_at, next_attempt_at from app.notification_outbox where status in ('failed', 'dead') order by created_at desc limit 30`) as unknown as {
      id: string; kind: string; channel: string; status: string; attempts: number; lastError: string | null; createdAt: Date; nextAttemptAt: Date;
    }[],
    lastWebhook: ((await tx`select max(received_at) as at, count(*) filter (where status = 'failed')::int as failed from app.integration_events where provider = 'whatsapp'`) as unknown as { at: Date | null; failed: number }[])[0],
    templates: ((await tx`select value from app.site_settings where key = 'whatsapp_templates'`) as unknown as { value: unknown }[])[0]?.value ?? [],
  }));
  const lastSent = data.outboxStats.find((s) => s.status === "sent")?.last;
  const emailState: State = e.EMAIL_PROVIDER === "resend" ? "Ligada" : e.EMAIL_PROVIDER === "log" ? "Modo de teste" : "Implementada e por ativar";
  const waState: State = e.WHATSAPP_PROVIDER === "cloud_api" ? "Ligada" : e.WHATSAPP_PROVIDER === "mock" ? "Modo de teste" : "Implementada e por ativar";
  return (
    <>
      <PageHeader title="Integrações" description="Estado real das integrações. «Ligada» significa que as credenciais estão configuradas; a entrega é confirmada pelos estados de cada envio." actions={<form action={runNowAction}><button className="btn btn-outline">Processar fila agora</button></form>} />
      <div className="panel overflow-x-auto">
        <table className="table">
          <tbody>
            <Row name="Base de dados" state="Ligada" detail={`Ambiente da base: ${data.instance} · aplicação: ${e.APP_ENV}`} />
            <Row name="Autenticação" state={e.AUTH_PROVIDER === "supabase" ? "Ligada" : "Modo de teste"} detail={e.AUTH_PROVIDER === "supabase" ? "Supabase Auth com MFA para administradores" : "Login de desenvolvimento (bloqueado em produção)"} />
            <Row name="Ficheiros" state={e.STORAGE_DRIVER === "supabase" ? "Ligada" : "Modo de teste"} detail={e.STORAGE_DRIVER === "supabase" ? "Supabase Storage" : "Disco local (só desenvolvimento)"} />
            <Row name="Email (Resend)" state={emailState} detail={lastSent ? `Último envio registado: ${formatShortDateTime(lastSent)}` : "Sem envios registados"} />
            <Row name="WhatsApp Cloud API" state={waState} detail={data.lastWebhook?.at ? `Último webhook: ${formatShortDateTime(data.lastWebhook.at)}${data.lastWebhook.failed ? ` · ${data.lastWebhook.failed} eventos com falha` : ""}` : "Nenhum webhook recebido"} />
            <Row name="WhatsApp Click to Chat" state="Ligada" detail="Botões wa.me no site (não envia nada a partir do servidor)" />
            <Row name="Google Analytics 4" state={process.env.NEXT_PUBLIC_GA4_ID ? "Ligada" : "Desativada"} detail="Só carrega com consentimento" />
            <Row name="Meta Pixel" state={process.env.NEXT_PUBLIC_META_PIXEL_ID ? "Ligada" : "Desativada"} detail="Só carrega com consentimento" />
            <Row name="Processamento agendado" state={e.CRON_SECRET ? "Ligada" : "Implementada e por ativar"} detail="/api/cron/outbox com CRON_SECRET" />
          </tbody>
        </table>
      </div>

      <h2 className="heading mt-8 text-lg">Fila de notificações</h2>
      <p className="mt-1 text-sm text-muted">{data.outboxStats.map((s) => `${s.status}: ${s.n}`).join(" · ") || "Vazia"}</p>
      {data.failures.length > 0 ? (
        <div className="panel mt-3 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Criada</th><th>Tipo</th><th>Canal</th><th>Estado</th><th>Tentativas</th><th>Erro</th><th></th></tr></thead>
            <tbody>
              {data.failures.map((f) => (
                <tr key={f.id}>
                  <td className="num">{formatShortDateTime(f.createdAt)}</td>
                  <td>{f.kind}</td>
                  <td>{f.channel}</td>
                  <td><span className={`tag ${f.status === "dead" ? "tag-danger" : "tag-warn"}`}>{f.status === "dead" ? "Falha definitiva" : `Nova tentativa ${formatShortDateTime(f.nextAttemptAt)}`}</span></td>
                  <td>{f.attempts}</td>
                  <td className="max-w-xs text-xs">{f.lastError}</td>
                  <td>
                    <form action={retryOutboxAction}><input type="hidden" name="id" value={f.id} /><button className="btn btn-outline btn-sm">Tentar novamente</button></form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-3"><Notice tone="ok">Sem falhas pendentes.</Notice></div>
      )}

      <h2 className="heading mt-8 text-lg">Templates WhatsApp</h2>
      <p className="mt-1 text-sm text-muted">Fora da janela de 24 h só é possível enviar templates aprovados pela Meta. O estado vem da Meta; não é assumido.</p>
      <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="panel p-4">
          <ActionForm action={saveTemplatesAction} submitLabel="Guardar templates" submitClassName="btn-sm">
            <textarea name="templates" defaultValue={JSON.stringify(data.templates, null, 2)} className="input min-h-56 font-mono text-xs" aria-label="Templates (JSON)" />
            <p className="field-hint">Formato: [{"{"}&quot;key&quot;:&quot;confirmacao_visita&quot;,&quot;label&quot;:&quot;Confirmação de visita&quot;,&quot;name&quot;:&quot;confirmacao_visita&quot;,&quot;language&quot;:&quot;pt_PT&quot;,&quot;status&quot;:&quot;APPROVED&quot;,&quot;params&quot;:[]{"}"}]</p>
          </ActionForm>
        </div>
        <div className="panel p-4">
          <ActionForm action={syncTemplatesAction} submitLabel="Sincronizar com a Meta" submitClassName="btn-outline btn-sm">
            <p className="max-w-[16rem] text-sm text-muted">Lê nome, idioma, categoria e estado dos templates da conta WhatsApp Business.</p>
          </ActionForm>
        </div>
      </div>
    </>
  );
}

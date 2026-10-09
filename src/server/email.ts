import "server-only";
import { env } from "@/lib/env";

/**
 * Email transacional atrás de uma interface própria. Fornecedor: Resend (HTTP API).
 * Em desenvolvimento, EMAIL_PROVIDER=log escreve na consola (sem dados pessoais completos).
 */
export interface EmailMessage {
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  idempotencyKey: string;
}

export type SendResult = { ok: true; providerId: string } | { ok: false; permanent: boolean; uncertain?: boolean; error: string };

export interface EmailProvider {
  name: string;
  send(msg: EmailMessage): Promise<SendResult>;
}

const resend: EmailProvider = {
  name: "resend",
  async send(msg) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          Authorization: `Bearer ${env().RESEND_API_KEY}`,
          "Content-Type": "application/json",
          // Reenvios com a mesma chave não duplicam o email (resultado incerto/timeout)
          "Idempotency-Key": msg.idempotencyKey.slice(0, 256),
        },
        body: JSON.stringify({
          from: env().EMAIL_FROM,
          to: msg.to,
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
          ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
      if (res.ok && json.id) return { ok: true, providerId: json.id };
      const permanent = res.status === 400 || res.status === 401 || res.status === 403 || res.status === 422;
      return { ok: false, permanent, error: `Resend ${res.status}: ${json.name ?? ""} ${json.message ?? ""}`.trim() };
    } catch (err) {
      return { ok: false, permanent: false, uncertain: true, error: ctrl.signal.aborted ? "Tempo esgotado" : (err as Error).message };
    } finally {
      clearTimeout(timer);
    }
  },
};

const log: EmailProvider = {
  name: "log",
  async send(msg) {
    console.info(`[email:log] para ${msg.to.map((t) => t.replace(/^(.).*(@.*)$/, "$1***$2")).join(", ")} — ${msg.subject}`);
    return { ok: true, providerId: `log-${msg.idempotencyKey}` };
  },
};

export function emailProvider(): EmailProvider | null {
  switch (env().EMAIL_PROVIDER) {
    case "resend":
      return resend;
    case "log":
      return log;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Modelos de email (HTML simples e acessível + versão texto)
// ---------------------------------------------------------------------------
function escape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function layout(title: string, paragraphs: string[], cta?: { label: string; url: string }, footer?: string): { html: string; text: string } {
  const html = `<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(title)}</title></head>
<body style="margin:0;background:#f3f5f7;font-family:Arial,Helvetica,sans-serif;color:#161a1f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #d9dee5;border-radius:10px" cellpadding="0" cellspacing="0">
<tr><td style="padding:24px 24px 8px"><p style="margin:0;font-size:13px;font-weight:bold;color:#3a5fa6">Inova Auto</p>
<h1 style="margin:8px 0 0;font-size:22px;line-height:1.3">${escape(title)}</h1></td></tr>
<tr><td style="padding:8px 24px 16px;font-size:15px;line-height:1.6">${paragraphs.map((p) => `<p style="margin:0 0 12px">${escape(p)}</p>`).join("")}
${cta ? `<p style="margin:16px 0"><a href="${escape(cta.url)}" style="display:inline-block;background:#3a5fa6;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 18px;border-radius:6px">${escape(cta.label)}</a></p>` : ""}
</td></tr>
${footer ? `<tr><td style="padding:12px 24px 20px;border-top:1px solid #d9dee5;font-size:12px;color:#59636f">${escape(footer)}</td></tr>` : ""}
</table></td></tr></table></body></html>`;
  const text = [title, "", ...paragraphs, ...(cta ? ["", `${cta.label}: ${cta.url}`] : []), ...(footer ? ["", "--", footer] : [])].join("\n");
  return { html, text };
}

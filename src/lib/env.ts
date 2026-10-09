import "server-only";
import { z } from "zod";

/**
 * Configuração tipada e validada. Falha cedo (no arranque) quando uma combinação é insegura,
 * por exemplo autenticação de desenvolvimento em produção.
 *
 * Variáveis com prefixo NEXT_PUBLIC_ são visíveis no navegador: nunca conter segredos.
 */
const bool = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((v) => v === "true" || v === "1");

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const schema = z
  .object({
    APP_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
    VERCEL_ENV: optionalString,
    NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),

    DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatório"),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),

    AUTH_PROVIDER: z.enum(["supabase", "dev"]).default("supabase"),
    DEV_AUTH_SECRET: optionalString,
    NEXT_PUBLIC_SUPABASE_URL: optionalString,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalString,
    SUPABASE_SECRET_KEY: optionalString,

    STORAGE_DRIVER: z.enum(["supabase", "local"]).default("supabase"),
    LOCAL_STORAGE_DIR: z.string().default(".data/storage"),

    EMAIL_PROVIDER: z.enum(["resend", "log", "disabled"]).default("disabled"),
    RESEND_API_KEY: optionalString,
    EMAIL_FROM: optionalString,
    EMAIL_REPLY_TO: optionalString,
    STAFF_NOTIFICATION_EMAILS: optionalString,

    WHATSAPP_PROVIDER: z.enum(["cloud_api", "mock", "disabled"]).default("disabled"),
    META_APP_SECRET: optionalString,
    WHATSAPP_VERIFY_TOKEN: optionalString,
    WHATSAPP_ACCESS_TOKEN: optionalString,
    WHATSAPP_PHONE_NUMBER_ID: optionalString,
    WHATSAPP_WABA_ID: optionalString,
    WHATSAPP_GRAPH_API_VERSION: optionalString,

    // Fora de produção, mensagens reais só podem ir para estes destinatários (separados por vírgula)
    OUTBOUND_ALLOWLIST: optionalString,

    CRON_SECRET: optionalString,
    RATE_LIMIT_SALT: optionalString,
    SEED_DEMO_ALLOWED: bool,
  })
  .superRefine((env, ctx) => {
    const prodLike = env.APP_ENV === "production";
    if (prodLike && env.AUTH_PROVIDER !== "supabase") {
      ctx.addIssue({ code: "custom", path: ["AUTH_PROVIDER"], message: "Produção exige AUTH_PROVIDER=supabase." });
    }
    if (prodLike && env.STORAGE_DRIVER !== "supabase") {
      ctx.addIssue({ code: "custom", path: ["STORAGE_DRIVER"], message: "Produção exige STORAGE_DRIVER=supabase." });
    }
    if (prodLike && env.WHATSAPP_PROVIDER === "mock") {
      ctx.addIssue({ code: "custom", path: ["WHATSAPP_PROVIDER"], message: "Mock de WhatsApp não é permitido em produção." });
    }
    if (prodLike && env.EMAIL_PROVIDER === "log") {
      ctx.addIssue({ code: "custom", path: ["EMAIL_PROVIDER"], message: "EMAIL_PROVIDER=log não é permitido em produção." });
    }
    if (prodLike && env.VERCEL_ENV === "preview") {
      ctx.addIssue({ code: "custom", path: ["APP_ENV"], message: "Uma pré-visualização não pode usar APP_ENV=production." });
    }
    if (prodLike && env.SEED_DEMO_ALLOWED) {
      ctx.addIssue({ code: "custom", path: ["SEED_DEMO_ALLOWED"], message: "Dados de demonstração não são permitidos em produção." });
    }
    if (env.AUTH_PROVIDER === "dev" && (!env.DEV_AUTH_SECRET || env.DEV_AUTH_SECRET.length < 32)) {
      ctx.addIssue({ code: "custom", path: ["DEV_AUTH_SECRET"], message: "DEV_AUTH_SECRET (32+ caracteres) é obrigatório com AUTH_PROVIDER=dev." });
    }
    if (env.AUTH_PROVIDER === "supabase" && (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) {
      ctx.addIssue({ code: "custom", path: ["NEXT_PUBLIC_SUPABASE_URL"], message: "Supabase Auth exige NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY." });
    }
    if (env.STORAGE_DRIVER === "supabase" && (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SECRET_KEY)) {
      ctx.addIssue({ code: "custom", path: ["SUPABASE_SECRET_KEY"], message: "Storage Supabase exige NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY." });
    }
    if (env.EMAIL_PROVIDER === "resend" && (!env.RESEND_API_KEY || !env.EMAIL_FROM)) {
      ctx.addIssue({ code: "custom", path: ["RESEND_API_KEY"], message: "Resend exige RESEND_API_KEY e EMAIL_FROM." });
    }
    if (env.WHATSAPP_PROVIDER === "cloud_api") {
      for (const key of ["META_APP_SECRET", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_GRAPH_API_VERSION"] as const) {
        if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: `${key} é obrigatório com WHATSAPP_PROVIDER=cloud_api.` });
      }
      if (env.WHATSAPP_GRAPH_API_VERSION && !/^v\d+\.\d+$/.test(env.WHATSAPP_GRAPH_API_VERSION)) {
        ctx.addIssue({ code: "custom", path: ["WHATSAPP_GRAPH_API_VERSION"], message: "Usa uma versão explícita, por exemplo v23.0 (nunca 'latest')." });
      }
    }
    if (prodLike && (!env.CRON_SECRET || env.CRON_SECRET.length < 32)) {
      ctx.addIssue({ code: "custom", path: ["CRON_SECRET"], message: "Produção exige CRON_SECRET com 32+ caracteres." });
    }
    if (prodLike && (!env.RATE_LIMIT_SALT || env.RATE_LIMIT_SALT.length < 16)) {
      ctx.addIssue({ code: "custom", path: ["RATE_LIMIT_SALT"], message: "Produção exige RATE_LIMIT_SALT." });
    }
  });

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Configuração inválida:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function isProduction() {
  return env().APP_ENV === "production";
}

/** Envio de mensagens reais a clientes só em produção, ou para destinatários autorizados. */
export function canSendTo(recipient: string): boolean {
  if (isProduction()) return true;
  const list = (env().OUTBOUND_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(recipient.trim().toLowerCase());
}

export function siteUrl(path = "/") {
  return new URL(path, env().NEXT_PUBLIC_SITE_URL).toString();
}

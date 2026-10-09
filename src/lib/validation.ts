import { z } from "zod";
import { BODY_TYPES, DRIVETRAINS, FUELS, ORIGINS, SORTS, TRANSMISSIONS, VAT_REGIMES, HISTORY_FACT_KEYS, VEHICLE_STATUSES } from "./domain";
import { normalizePhone } from "./phone";

/** Versão do texto de privacidade/autorização apresentado nos formulários. */
export const CONSENT_TEXT_VERSION = "2026-10-08";

const trimmed = (max: number) => z.string().trim().max(max);
const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => !v || z.email().safeParse(v).success, { message: "Indica um email válido." });

const phone = z
  .string()
  .trim()
  .max(30)
  .optional()
  .transform((v, ctx) => {
    if (!v) return undefined;
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Indica um telefone válido. Para números estrangeiros inclui o indicativo, ex.: +44…" });
      return z.NEVER;
    }
    return n;
  });

const contactBase = z.object({
  name: trimmed(120).min(2, "Indica o teu nome."),
  email,
  phone,
  preferredChannel: z.enum(["phone", "email", "whatsapp"]).optional(),
  // Autorizações separadas: responder ao pedido não depende de consentimento de marketing.
  allowWhatsapp: z.boolean().default(false),
  allowMarketing: z.boolean().default(false),
  // Antiabuso
  website: z.string().max(0, "Pedido inválido.").optional(), // honeypot: tem de ficar vazio
  startedAt: z.coerce.number().int().optional(), // ms em que o formulário foi apresentado
  idempotencyKey: z.string().uuid("Pedido inválido."),
  pageUrl: optionalTrimmed(500),
});

function requireOneContact<T extends { email?: string; phone?: string; preferredChannel?: string }>(v: T, ctx: z.RefinementCtx) {
  if (!v.email && !v.phone) {
    ctx.addIssue({ code: "custom", path: ["email"], message: "Indica pelo menos um contacto: telefone ou email." });
  }
  if (v.preferredChannel === "email" && !v.email) {
    ctx.addIssue({ code: "custom", path: ["email"], message: "Indica o email para te respondermos por email." });
  }
  if ((v.preferredChannel === "phone" || v.preferredChannel === "whatsapp") && !v.phone) {
    ctx.addIssue({ code: "custom", path: ["phone"], message: "Indica o telefone para te contactarmos por esse meio." });
  }
}

export const leadInput = contactBase
  .extend({
    kind: z.enum(["info", "financing"]).default("info"),
    vehicleId: z.string().uuid().optional(),
    message: optionalTrimmed(4000),
  })
  .superRefine(requireOneContact);
export type LeadInput = z.infer<typeof leadInput>;

export const appointmentInput = contactBase
  .extend({
    vehicleId: z.string().uuid().optional(),
    branchId: z.string().uuid(),
    kind: z.enum(["visit", "test_drive"]),
    requestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolhe uma data."),
    requestedPeriod: z.enum(["morning", "afternoon"]),
    message: optionalTrimmed(2000),
  })
  .superRefine(requireOneContact);
export type AppointmentInput = z.infer<typeof appointmentInput>;

const currentYear = new Date().getFullYear();
export const tradeInInput = contactBase
  .extend({
    vehicleId: z.string().uuid().optional(), // viatura que a pessoa quer comprar, se aplicável
    make: trimmed(60).min(1, "Indica a marca."),
    model: trimmed(80).min(1, "Indica o modelo."),
    year: z.coerce.number().int().min(1950, "Ano inválido.").max(currentYear + 1, "Ano inválido."),
    mileageKm: z.coerce.number().int().min(0, "Quilometragem inválida.").max(2_000_000, "Quilometragem inválida."),
    fuel: z.enum(FUELS),
    condition: optionalTrimmed(2000),
    message: optionalTrimmed(2000),
  })
  .superRefine(requireOneContact);
export type TradeInInput = z.infer<typeof tradeInInput>;

export const savedSearchInput = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Indica um email válido.")),
  criteria: z.record(z.string(), z.string()),
  website: z.string().max(0).optional(),
});

// ---------------------------------------------------------------------------
// Pesquisa no catálogo (URL ↔ filtros)
// ---------------------------------------------------------------------------
const intParam = (min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined || v === "") return undefined;
      const n = Number(v.replace(/\s/g, ""));
      return Number.isInteger(n) && n >= min && n <= max ? n : undefined;
    });

const listParam = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter((x): x is T[number] => (values as readonly string[]).includes(x)) : []));

export const vehicleFilters = z.object({
  q: z
    .string()
    .optional()
    .transform((v) => (v ? v.trim().slice(0, 80) : undefined)),
  marca: z.string().optional().transform((v) => (v ? v.trim().slice(0, 60) : undefined)),
  modelo: z.string().optional().transform((v) => (v ? v.trim().slice(0, 80) : undefined)),
  precoMin: intParam(0, 10_000_000),
  precoMax: intParam(0, 10_000_000),
  anoMin: intParam(1950, 2100),
  anoMax: intParam(1950, 2100),
  kmMin: intParam(0, 3_000_000),
  kmMax: intParam(0, 3_000_000),
  potenciaMin: intParam(0, 2000),
  potenciaMax: intParam(0, 2000),
  combustivel: listParam(FUELS),
  caixa: listParam(TRANSMISSIONS),
  carrocaria: listParam(BODY_TYPES),
  tracao: listParam(DRIVETRAINS),
  lugares: intParam(1, 9),
  portas: intParam(1, 7),
  cor: z.string().optional().transform((v) => (v ? v.trim().slice(0, 40) : undefined)),
  instalacao: z.string().optional().transform((v) => (v && /^[a-z0-9-]+$/.test(v) ? v : undefined)),
  equipamento: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 10) : [])),
  ordem: z.enum(SORTS).optional().catch(undefined),
  pagina: intParam(1, 1000),
});
export type VehicleFilters = z.infer<typeof vehicleFilters>;

/** Erros de intervalo (mínimo > máximo) apresentados ao visitante, sem corrigir silenciosamente. */
export function filterRangeErrors(f: VehicleFilters): string[] {
  const errors: string[] = [];
  if (f.precoMin !== undefined && f.precoMax !== undefined && f.precoMin > f.precoMax) errors.push("O preço mínimo é superior ao máximo.");
  if (f.anoMin !== undefined && f.anoMax !== undefined && f.anoMin > f.anoMax) errors.push("O ano mínimo é superior ao máximo.");
  if (f.kmMin !== undefined && f.kmMax !== undefined && f.kmMin > f.kmMax) errors.push("Os quilómetros mínimos são superiores aos máximos.");
  if (f.potenciaMin !== undefined && f.potenciaMax !== undefined && f.potenciaMin > f.potenciaMax) errors.push("A potência mínima é superior à máxima.");
  return errors;
}

// ---------------------------------------------------------------------------
// Edição de viaturas (painel)
// ---------------------------------------------------------------------------
const optInt = (min: number, max: number, label: string) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : typeof v === "string" ? Number(v.replace(/\s/g, "")) : v),
    z.number({ message: `${label}: valor inválido.` }).int(`${label}: usa um número inteiro.`).min(min, `${label}: mínimo ${min}.`).max(max, `${label}: máximo ${max}.`).nullable(),
  );
const optEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (v === "" || v === undefined ? null : v), z.enum(values).nullable());
const optText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v ?? null), z.string().max(max).nullable());

export const historyFact = z.object({
  key: z.enum(HISTORY_FACT_KEYS),
  value: z.string().trim().min(1).max(200),
  source: z.string().trim().min(2, "Indica a fonte (ex.: DUA, livro de revisões).").max(200),
  verified_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Indica a data de verificação."),
});

export const vehicleEditorInput = z
  .object({
    make: z.string().trim().min(1, "Indica a marca.").max(60),
    model: z.string().trim().min(1, "Indica o modelo.").max(80),
    versionName: optText(120),
    status: z.enum(VEHICLE_STATUSES),
    branchId: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.string().uuid().nullable()),
    priceEuros: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : typeof v === "string" ? Number(v.replace(/\s/g, "").replace(",", ".")) : v),
      z.number({ message: "Preço inválido." }).positive("O preço tem de ser positivo.").max(10_000_000).nullable(),
    ),
    vatRegime: z.enum(VAT_REGIMES),
    firstRegistrationYear: optInt(1950, 2100, "Ano"),
    firstRegistrationMonth: optInt(1, 12, "Mês"),
    mileageKm: optInt(0, 3_000_000, "Quilómetros"),
    fuel: optEnum(FUELS),
    transmission: optEnum(TRANSMISSIONS),
    bodyType: optEnum(BODY_TYPES),
    powerHp: optInt(1, 2000, "Potência"),
    engineCc: optInt(1, 10000, "Cilindrada"),
    doors: optInt(1, 7, "Portas"),
    seats: optInt(1, 9, "Lugares"),
    drivetrain: optEnum(DRIVETRAINS),
    color: optText(40),
    origin: optEnum(ORIGINS),
    evRangeKm: optInt(1, 2000, "Autonomia"),
    evRangeStandard: optText(40),
    evBatteryKwh: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(String(v).replace(",", "."))),
      z.number().positive().max(300).nullable(),
    ),
    evCharging: optText(200),
    evBatterySohPercent: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(String(v).replace(",", "."))),
      z.number({ message: "Estado da bateria: valor inválido." }).positive().max(100).nullable(),
    ),
    evDataSource: optText(200),
    evDataDate: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
    historyFacts: z.array(historyFact).max(10).default([]),
    description: optText(6000),
    warrantyText: optText(2000),
    videoUrl: z.preprocess(
      (v) => (v === "" || v === undefined ? null : v),
      z
        .string()
        .url()
        .refine((u) => /^https:\/\/(www\.youtube-nocookie\.com|www\.youtube\.com|youtu\.be|player\.vimeo\.com|vimeo\.com)\//.test(u), "Só são aceites vídeos do YouTube ou Vimeo.")
        .nullable(),
    ),
    isFeatured: z.boolean().default(false),
    featureIds: z.array(z.string().uuid()).max(200).default([]),
    // privados
    vin: z.preprocess(
      (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim().toUpperCase()) : null),
      z.string().regex(/^[A-HJ-NPR-Z0-9]{17}$/, "VIN inválido (17 caracteres, sem I, O, Q).").nullable(),
    ),
    plate: optText(20),
    purchaseCostEuros: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(String(v).replace(/\s/g, "").replace(",", "."))),
      z.number().min(0).max(10_000_000).nullable(),
    ),
    internalNotes: optText(4000),
    expectedVersion: z.coerce.number().int().optional(),
  })
  .superRefine((v, ctx) => {
    const ev = v.evRangeKm !== null || v.evBatterySohPercent !== null || v.evBatteryKwh !== null;
    if (ev && (!v.evDataSource || !v.evDataDate)) {
      ctx.addIssue({ code: "custom", path: ["evDataSource"], message: "Dados de bateria e autonomia exigem fonte e data." });
    }
    if (v.evRangeKm !== null && !v.evRangeStandard) {
      ctx.addIssue({ code: "custom", path: ["evRangeStandard"], message: "Indica a norma da autonomia (ex.: WLTP)." });
    }
    if (v.status === "available" || v.status === "reserved") {
      if (v.priceEuros === null) ctx.addIssue({ code: "custom", path: ["priceEuros"], message: "Para publicar, indica o preço." });
      if (v.firstRegistrationYear === null) ctx.addIssue({ code: "custom", path: ["firstRegistrationYear"], message: "Para publicar, indica o ano." });
      if (v.mileageKm === null) ctx.addIssue({ code: "custom", path: ["mileageKm"], message: "Para publicar, indica os quilómetros." });
      if (v.fuel === null) ctx.addIssue({ code: "custom", path: ["fuel"], message: "Para publicar, indica o combustível." });
      if (v.transmission === null) ctx.addIssue({ code: "custom", path: ["transmission"], message: "Para publicar, indica a caixa." });
    }
  });
export type VehicleEditorInput = z.infer<typeof vehicleEditorInput>;

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

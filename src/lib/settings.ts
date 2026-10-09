import "server-only";
import { cache } from "react";
import { z } from "zod";
import { asPublic, asSystem, type Tx } from "./db";
import { SERVICES, type ServiceKey } from "./domain";

/**
 * Configurações do site guardadas em app.site_settings (editáveis no painel).
 * Campos comerciais começam vazios: o site mostra "por preencher" no painel e esconde
 * a informação em falta no site público, em vez de inventar dados.
 */
export const companySchema = z.object({
  tradeName: z.string().default("Inova Auto"),
  legalName: z.string().nullable().default(null),
  nif: z.string().nullable().default(null),
  email: z.string().nullable().default(null),
  phoneE164: z.string().nullable().default(null),
  whatsappE164: z.string().nullable().default(null),
  instagramUrl: z.string().nullable().default(null),
  facebookUrl: z.string().nullable().default(null),
  privacyEmail: z.string().nullable().default(null),
  valueProposition: z.string().nullable().default(null),
  aboutText: z.string().nullable().default(null),
});
export type Company = z.infer<typeof companySchema>;

export const servicesSchema = z.object(Object.fromEntries(SERVICES.map((s) => [s, z.boolean().default(false)])) as Record<ServiceKey, z.ZodDefault<z.ZodBoolean>>);
export type Services = Record<ServiceKey, boolean>;

export const legalSchema = z.object({
  complaintsBookUrl: z.string().nullable().default("https://www.livroreclamacoes.pt/"),
  ralEntityName: z.string().nullable().default(null),
  ralEntityUrl: z.string().nullable().default(null),
  ralEntityAddress: z.string().nullable().default(null),
  creditIntermediaryText: z.string().nullable().default(null),
  dataRetentionText: z.string().nullable().default(null),
  consentVersion: z.string().default("2026-10-08"),
});
export type Legal = z.infer<typeof legalSchema>;

export const crmSchema = z.object({
  autoAssign: z.boolean().default(true),
  unansweredAlertMinutes: z.number().int().min(5).max(10080).default(120),
  reservationDefaultDays: z.number().int().min(1).max(30).default(3),
  appointmentSlotMinutes: z.number().int().min(15).max(240).default(60),
});
export type Crm = z.infer<typeof crmSchema>;

export const financingSchema = z.object({
  // Simulador numérico só com condições aprovadas. Sem isto, financiamento = pedido de contacto.
  simulatorEnabled: z.boolean().default(false),
  partnerName: z.string().nullable().default(null),
  approvedBy: z.string().nullable().default(null),
  approvedOn: z.string().nullable().default(null),
});

export const SETTINGS_SCHEMAS = {
  company: companySchema,
  services: servicesSchema,
  legal: legalSchema,
  crm: crmSchema,
  financing: financingSchema,
} as const;
export type SettingsKey = keyof typeof SETTINGS_SCHEMAS;
export const PUBLIC_SETTINGS: SettingsKey[] = ["company", "services", "legal", "financing"];

export interface PublicSettings {
  company: Company;
  services: Services;
  legal: Legal;
  financing: z.infer<typeof financingSchema>;
}

function parse<K extends SettingsKey>(key: K, value: unknown): z.infer<(typeof SETTINGS_SCHEMAS)[K]> {
  const res = SETTINGS_SCHEMAS[key].safeParse(value ?? {});
  return (res.success ? res.data : SETTINGS_SCHEMAS[key].parse({})) as z.infer<(typeof SETTINGS_SCHEMAS)[K]>;
}

export async function readSettings(tx: Tx, keys: SettingsKey[]) {
  const rows = await tx<{ key: string; value: unknown }[]>`select key, value from app.site_settings where key in ${tx(keys)}`;
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(keys.map((k) => [k, parse(k, map.get(k))])) as { [K in SettingsKey]: z.infer<(typeof SETTINGS_SCHEMAS)[K]> };
}

export const getPublicSettings = cache(async (): Promise<PublicSettings> => {
  try {
    const s = await asPublic((tx) => readSettings(tx, PUBLIC_SETTINGS));
    return { company: s.company, services: s.services as Services, legal: s.legal, financing: s.financing };
  } catch (err) {
    console.error("Falha a ler configurações públicas", err);
    return {
      company: companySchema.parse({}),
      services: servicesSchema.parse({}) as Services,
      legal: legalSchema.parse({}),
      financing: financingSchema.parse({}),
    };
  }
});

export async function getCrmSettings(): Promise<Crm> {
  return asSystem(async (tx) => (await readSettings(tx, ["crm"])).crm);
}

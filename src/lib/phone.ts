import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";

/**
 * Normaliza um número de telefone para E.164.
 * Aceita números de qualquer país com indicativo (+44…, +55…). Sem indicativo, assume o país
 * indicado (Portugal por omissão) — só nesse caso; nunca reescreve um número estrangeiro.
 */
export function normalizePhone(raw: string | null | undefined, defaultCountry: CountryCode = "PT"): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^00/, "+");
  if (cleaned === "") return null;
  const parsed = parsePhoneNumberFromString(cleaned, cleaned.startsWith("+") ? undefined : defaultCountry);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number; // E.164
}

/** Formato legível: "+351 912 345 678". */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatInternational() : e164;
}

/** Dígitos para wa.me (sem "+", sem espaços). */
export function waDigits(e164: string): string {
  return e164.replace(/\D/g, "");
}

/**
 * Indicação do custo da chamada exigida junto de números de telefone (DL 59/2021).
 * Só para números portugueses; números estrangeiros não recebem nota automática.
 */
export function callCostNote(e164: string | null | undefined): string | null {
  if (!e164 || !e164.startsWith("+351")) return null;
  const first = e164.charAt(4);
  if (first === "9") return "Chamada para a rede móvel nacional";
  if (first === "2") return "Chamada para a rede fixa nacional";
  return null;
}

import { NOT_STATED } from "./domain";

export const TIME_ZONE = "Europe/Lisbon";

const eur = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eurCents = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const int = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0, useGrouping: "always" } as Intl.NumberFormatOptions);

/** Preço em cêntimos → "18 900 €". Nunca devolve "0 €" para valores em falta. */
export function formatPrice(cents: number | null | undefined, opts: { exact?: boolean } = {}): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents) || cents <= 0) return "Preço sob consulta";
  return (opts.exact ? eurCents : eur).format(cents / 100);
}

/** Quilómetros → "45 300 km". Nunca devolve "0 km" para valores em falta. */
export function formatKm(km: number | null | undefined): string {
  if (km === null || km === undefined || !Number.isFinite(km)) return NOT_STATED;
  return `${int.format(km)} km`;
}

export function formatNumber(n: number | null | undefined, suffix = ""): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return NOT_STATED;
  return `${int.format(n)}${suffix}`;
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function formatRegistration(year: number | null | undefined, month?: number | null): string {
  if (!year) return NOT_STATED;
  if (month && month >= 1 && month <= 12) return `${String(month).padStart(2, "0")}/${year}`;
  return String(year);
}

export function monthName(month: number) {
  return MONTHS[month - 1] ?? "";
}

/** Data/hora em Europe/Lisbon, ex.: "8 de outubro de 2026, 18:25". */
export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("pt-PT", { timeZone: TIME_ZONE, dateStyle: "long", timeStyle: "short" }).format(d);
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T12:00:00Z` : value) : value;
  return new Intl.DateTimeFormat("pt-PT", { timeZone: TIME_ZONE, dateStyle: "long" }).format(d);
}

export function formatShortDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("pt-PT", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);
}

/** Data de hoje (AAAA-MM-DD) no fuso de Lisboa. */
export function todayInLisbon(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/**
 * Converte uma data e hora locais de Lisboa (ex.: "2026-10-25", "10:30") para um instante UTC.
 * Trata as mudanças de hora: calcula o desvio real de Lisboa nesse dia.
 */
export function lisbonLocalToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  // Primeira aproximação: tratar como UTC e corrigir pelo desvio de Lisboa nesse instante
  const guess = Date.UTC(y!, m! - 1, d!, hh!, mm!);
  const offset1 = lisbonOffsetMinutes(new Date(guess));
  const candidate = guess - offset1 * 60_000;
  const offset2 = lisbonOffsetMinutes(new Date(candidate));
  return new Date(guess - offset2 * 60_000);
}

/** Desvio de Lisboa face a UTC em minutos (0 no inverno, 60 no verão). */
export function lisbonOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUtc - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000);
}

/** Dia da semana (mon..sun) de uma data AAAA-MM-DD. */
export function weekdayKey(date: string): "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun" {
  const keys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
  const d = new Date(`${date}T12:00:00Z`);
  return keys[d.getUTCDay()]!;
}

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * CSV seguro: neutraliza fórmulas maliciosas (CSV injection) prefixando com apóstrofo
 * as células que começam por = + - @ tab ou CR, e aplica aspas quando necessário.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",;\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: unknown[][], sep = ";"): string {
  // ";" por omissão: o Excel em PT abre corretamente. BOM para acentos.
  return "﻿" + [headers, ...rows].map((r) => r.map(csvCell).join(sep)).join("\r\n") + "\r\n";
}

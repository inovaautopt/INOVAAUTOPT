import { describe, expect, it } from "vitest";
import { formatKm, formatPrice, formatRegistration, lisbonLocalToUtc, lisbonOffsetMinutes, slugify, weekdayKey } from "@/lib/format";
import { callCostNote, normalizePhone } from "@/lib/phone";

describe("formatação PT", () => {
  it("nunca mostra 0 € ou 0 km quando o dado falta", () => {
    expect(formatPrice(null)).toBe("Preço sob consulta");
    expect(formatPrice(0)).toBe("Preço sob consulta");
    expect(formatKm(null)).toBe("Não indicado");
    expect(formatKm(undefined)).toBe("Não indicado");
  });
  it("formata preço e km em pt-PT", () => {
    expect(formatPrice(1899000).replace(/\s/g, " ")).toBe("18 990 €");
    expect(formatKm(45300).replace(/\s/g, " ")).toBe("45 300 km");
    expect(formatKm(0).replace(/\s/g, " ")).toBe("0 km"); // zero real (viatura nova) é dado, não ausência
  });
  it("primeira matrícula com e sem mês", () => {
    expect(formatRegistration(2021, 3)).toBe("03/2021");
    expect(formatRegistration(2021, null)).toBe("2021");
    expect(formatRegistration(null)).toBe("Não indicado");
  });
  it("converte hora local de Lisboa para UTC com mudança de hora", () => {
    // Verão (UTC+1)
    expect(lisbonLocalToUtc("2026-07-15", "10:00").toISOString()).toBe("2026-07-15T09:00:00.000Z");
    // Inverno (UTC+0)
    expect(lisbonLocalToUtc("2026-12-15", "10:00").toISOString()).toBe("2026-12-15T10:00:00.000Z");
    // Dia da mudança (25 out 2026, 02:00 → 01:00): tarde já em UTC+0
    expect(lisbonLocalToUtc("2026-10-25", "15:00").toISOString()).toBe("2026-10-25T15:00:00.000Z");
    // Dia da mudança de março (29 mar 2026): tarde já em UTC+1
    expect(lisbonLocalToUtc("2026-03-29", "15:00").toISOString()).toBe("2026-03-29T14:00:00.000Z");
    expect(lisbonOffsetMinutes(new Date("2026-08-01T12:00:00Z"))).toBe(60);
  });
  it("dia da semana e slug", () => {
    expect(weekdayKey("2026-10-11")).toBe("sun");
    expect(slugify("Série 1 116d Advantage — IA-0001")).toBe("serie-1-116d-advantage-ia-0001");
  });
});

describe("telefones E.164", () => {
  it("assume Portugal só sem indicativo", () => {
    expect(normalizePhone("912 345 678")).toBe("+351912345678");
    expect(normalizePhone("+351 21 000 0000")).toBe("+351210000000");
  });
  it("aceita números estrangeiros sem os reescrever", () => {
    expect(normalizePhone("+44 7911 123456")).toBe("+447911123456");
    expect(normalizePhone("0055 11 91234 5678")).toBe("+5511912345678");
  });
  it("rejeita números inválidos", () => {
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
  });
  it("nota de custo da chamada", () => {
    expect(callCostNote("+351912345678")).toBe("Chamada para a rede móvel nacional");
    expect(callCostNote("+351210000000")).toBe("Chamada para a rede fixa nacional");
    expect(callCostNote("+447911123456")).toBeNull();
  });
});

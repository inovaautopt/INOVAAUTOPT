import { describe, expect, it } from "vitest";
import { filterRangeErrors, leadInput, vehicleEditorInput, vehicleFilters, tradeInInput } from "@/lib/validation";

const key = "6f1b1c3e-2a6d-4f54-9a2e-6f1d2b3c4d5e";

describe("formulários públicos", () => {
  it("exige pelo menos um contacto válido", () => {
    const r = leadInput.safeParse({ name: "Ana", idempotencyKey: key });
    expect(r.success).toBe(false);
    expect(leadInput.safeParse({ name: "Ana", phone: "912345678", idempotencyKey: key }).success).toBe(true);
    expect(leadInput.safeParse({ name: "Ana", email: "ana@example.com", idempotencyKey: key }).success).toBe(true);
  });
  it("normaliza o telefone e rejeita inválidos", () => {
    const r = leadInput.parse({ name: "Ana", phone: "912 345 678", idempotencyKey: key });
    expect(r.phone).toBe("+351912345678");
    expect(leadInput.safeParse({ name: "Ana", phone: "12", idempotencyKey: key }).success).toBe(false);
  });
  it("marketing não é obrigatório para pedir informação", () => {
    const r = leadInput.parse({ name: "Ana", phone: "912345678", idempotencyKey: key });
    expect(r.allowMarketing).toBe(false);
  });
  it("canal preferido exige o contacto correspondente", () => {
    expect(leadInput.safeParse({ name: "Ana", phone: "912345678", preferredChannel: "email", idempotencyKey: key }).success).toBe(false);
  });
  it("honeypot preenchido falha a validação", () => {
    expect(leadInput.safeParse({ name: "Ana", phone: "912345678", website: "spam", idempotencyKey: key }).success).toBe(false);
  });
  it("retoma sem preço automático e com ano válido", () => {
    expect(tradeInInput.safeParse({ name: "Rui", phone: "912345678", make: "Opel", model: "Corsa", year: 1900, mileageKm: 10, fuel: "diesel", idempotencyKey: key }).success).toBe(false);
    expect(tradeInInput.safeParse({ name: "Rui", phone: "912345678", make: "Opel", model: "Corsa", year: 2015, mileageKm: 120000, fuel: "diesel", idempotencyKey: key }).success).toBe(true);
  });
});

describe("filtros do catálogo", () => {
  it("lê o URL e ignora valores inválidos", () => {
    const f = vehicleFilters.parse({ precoMax: "20000", combustivel: "diesel,banana", ordem: "price_asc", pagina: "2" });
    expect(f.precoMax).toBe(20000);
    expect(f.combustivel).toEqual(["diesel"]);
    expect(f.pagina).toBe(2);
    expect(vehicleFilters.parse({ ordem: "hack" }).ordem).toBeUndefined();
  });
  it("não corrige intervalos invertidos silenciosamente", () => {
    const f = vehicleFilters.parse({ precoMin: "30000", precoMax: "10000" });
    expect(filterRangeErrors(f)).toContain("O preço mínimo é superior ao máximo.");
  });
});

describe("regras de publicação", () => {
  const base = { make: "Peugeot", model: "208", versionName: "", branchId: "", priceEuros: "", vatRegime: "unknown", firstRegistrationYear: "", firstRegistrationMonth: "", mileageKm: "", fuel: "", transmission: "", bodyType: "", powerHp: "", engineCc: "", doors: "", seats: "", drivetrain: "", color: "", origin: "", evRangeKm: "", evRangeStandard: "", evBatteryKwh: "", evCharging: "", evBatterySohPercent: "", evDataSource: "", evDataDate: "", description: "", warrantyText: "", videoUrl: "", vin: "", plate: "", purchaseCostEuros: "", internalNotes: "" };
  it("rascunho pode ficar incompleto", () => {
    expect(vehicleEditorInput.safeParse({ ...base, status: "draft" }).success).toBe(true);
  });
  it("publicar exige preço, IVA, ano, km, combustível e caixa", () => {
    const r = vehicleEditorInput.safeParse({ ...base, status: "available" });
    expect(r.success).toBe(false);
    const ok = vehicleEditorInput.safeParse({ ...base, status: "available", priceEuros: "16990", vatRegime: "margin_scheme", firstRegistrationYear: "2024", mileageKm: "44832", fuel: "gasoline", transmission: "manual" });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.priceEuros).toBe(16990);
  });
  it("dados de bateria exigem fonte e data", () => {
    expect(vehicleEditorInput.safeParse({ ...base, status: "draft", evBatterySohPercent: "93" }).success).toBe(false);
    expect(vehicleEditorInput.safeParse({ ...base, status: "draft", evBatterySohPercent: "93", evDataSource: "Diagnóstico", evDataDate: "2026-10-07" }).success).toBe(true);
  });
  it("VIN tem de ser válido", () => {
    expect(vehicleEditorInput.safeParse({ ...base, status: "draft", vin: "ABC" }).success).toBe(false);
    expect(vehicleEditorInput.safeParse({ ...base, status: "draft", vin: "VF3MRHNSUKS123456" }).success).toBe(true);
  });
  it("vídeo só de plataformas autorizadas", () => {
    expect(vehicleEditorInput.safeParse({ ...base, status: "draft", videoUrl: "https://evil.example.com/v.mp4" }).success).toBe(false);
    expect(vehicleEditorInput.safeParse({ ...base, status: "draft", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }).success).toBe(true);
  });
});
